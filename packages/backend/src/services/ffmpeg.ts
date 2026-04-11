import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { uploadFile, generateFileKey } from './storage.js'

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'

export interface CompositionSegment {
  segmentId: string
  videoUrl: string
  startTime: number
  endTime: number
  transition?: string
}

export interface CompositionOptions {
  segments: CompositionSegment[]
  voiceoverUrl?: string
  bgmUrl?: string
  subtitlesUrl?: string
  outputWidth?: number
  outputHeight?: number
  outputFormat?: 'mp4' | 'webm'
}

export interface CompositionResult {
  outputUrl: string
  duration: number
  width: number
  height: number
}

/**
 * Download a file from URL to a temporary file
 */
async function downloadToTemp(url: string): Promise<string> {
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const tempFile = path.join(os.tmpdir(), `temp_${Date.now()}.mp4`)
  await fs.writeFile(tempFile, buffer)
  return tempFile
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ])

    let output = ''
    ffprobe.stdout.on('data', (data) => { output += data })
    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(output.trim()) || 0)
      } else {
        reject(new Error(`ffprobe exited with code ${code}`))
      }
    })
    ffprobe.on('error', reject)
  })
}

/**
 * Merge multiple video segments using FFmpeg
 */
async function mergeSegments(segments: CompositionSegment[], outputPath: string): Promise<void> {
  // Create a temporary file list for FFmpeg concat
  const listFile = path.join(os.tmpdir(), `concat_list_${Date.now()}.txt`)
  let listContent = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const tempFile = await downloadToTemp(segment.videoUrl)
    const startTime = segment.startTime || 0
    const duration = segment.endTime - startTime

    // If we have a start time, we need to trim
    if (startTime > 0) {
      const trimmedFile = path.join(os.tmpdir(), `trim_${i}_${Date.now()}.mp4`)
      await trimVideo(tempFile, trimmedFile, startTime, duration)
      listContent += `file '${trimmedFile}'\n`
      await fs.unlink(tempFile).catch(() => {})
    } else {
      // Just trim to duration
      const trimmedFile = path.join(os.tmpdir(), `trim_${i}_${Date.now()}.mp4`)
      await trimVideo(tempFile, trimmedFile, 0, duration)
      listContent += `file '${trimmedFile}'\n`
      await fs.unlink(tempFile).catch(() => {})
    }
  }

  await fs.writeFile(listFile, listContent)

  // Concatenate all segments
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, [
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      fs.unlink(listFile).catch(() => {})
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg concat exited with code ${code}`))
      }
    })
    ffmpeg.on('error', reject)
  })
}

/**
 * Trim a video file
 */
async function trimVideo(inputPath: string, outputPath: string, start: number, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, [
      '-i', inputPath,
      '-ss', start.toString(),
      '-t', duration.toString(),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg trim exited with code ${code}`))
      }
    })
    ffmpeg.on('error', reject)
  })
}

/**
 * Add audio track (voiceover or BGM) to video
 */
async function addAudio(videoPath: string, audioPath: string, outputPath: string, type: 'voiceover' | 'bgm'): Promise<void> {
  const audioVolume = type === 'voiceover' ? '1.0' : '0.3' // BGM at 30% volume

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, [
      '-i', videoPath,
      '-i', audioPath,
      '-filter_complex', `[1:a]volume=${audioVolume}[a]`,
      '-map', '0:v',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg add audio exited with code ${code}`))
      }
    })
    ffmpeg.on('error', reject)
  })
}

/**
 * Burn subtitles into video
 */
async function burnSubtitles(videoPath: string, subtitlePath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, [
      '-i', videoPath,
      '-vf', `subtitles='${subtitlePath}'`,
      '-c:a', 'copy',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg burn subtitles exited with code ${code}`))
      }
    })
    ffmpeg.on('error', reject)
  })
}

/**
 * Main composition function
 */
export async function composeVideo(options: CompositionOptions): Promise<CompositionResult> {
  const {
    segments,
    voiceoverUrl,
    bgmUrl,
    subtitlesUrl,
    outputWidth = 1080,
    outputHeight = 1920,
    outputFormat = 'mp4'
  } = options

  const tempDir = os.tmpdir()
  const mergedVideo = path.join(tempDir, `merged_${Date.now()}.${outputFormat}`)
  const withAudio = path.join(tempDir, `audio_${Date.now()}.${outputFormat}`)
  const withSubs = path.join(tempDir, `subs_${Date.now()}.${outputFormat}`)
  const finalOutput = path.join(tempDir, `final_${Date.now()}.${outputFormat}`)

  try {
    // Step 1: Merge segments
    console.log('Merging video segments...')
    await mergeSegments(segments, mergedVideo)

    let currentVideo = mergedVideo

    // Step 2: Add voiceover if provided
    if (voiceoverUrl) {
      console.log('Adding voiceover...')
      await addAudio(currentVideo, voiceoverUrl, withAudio, 'voiceover')
      currentVideo = withAudio
    }

    // Step 3: Add BGM if provided
    if (bgmUrl) {
      console.log('Adding background music...')
      const withBgm = path.join(tempDir, `bgm_${Date.now()}.${outputFormat}`)
      await addAudio(currentVideo, bgmUrl, withBgm, 'bgm')
      currentVideo = withBgm
    }

    // Step 4: Burn subtitles if provided
    if (subtitlesUrl) {
      console.log('Burning subtitles...')
      await burnSubtitles(currentVideo, subtitlesUrl, withSubs)
      currentVideo = withSubs
    }

    // Step 5: Scale to output resolution if needed
    if (currentVideo !== finalOutput) {
      console.log('Scaling video...')
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(FFMPEG_PATH, [
          '-i', currentVideo,
          '-vf', `scale=${outputWidth}:${outputHeight}`,
          '-c:a', 'copy',
          finalOutput
        ])

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`FFmpeg scale exited with code ${code}`))
          }
        })
        ffmpeg.on('error', reject)
      })
    }

    // Step 6: Upload to MinIO
    console.log('Uploading to storage...')
    const videoBuffer = await fs.readFile(finalOutput)
    const key = generateFileKey('videos', `composition_${Date.now()}.${outputFormat}`)
    const outputUrl = await uploadFile('videos', key, videoBuffer, `video/${outputFormat}`)

    // Get final duration
    const duration = await getVideoDuration(finalOutput)

    // Cleanup temp files
    const cleanupFiles = [mergedVideo, withAudio, withSubs, finalOutput]
    for (const file of cleanupFiles) {
      await fs.unlink(file).catch(() => {})
    }

    return {
      outputUrl,
      duration,
      width: outputWidth,
      height: outputHeight
    }
  } catch (error) {
    console.error('Composition failed:', error)
    throw error
  }
}
