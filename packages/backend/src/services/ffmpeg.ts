import { promises as fs } from 'fs'
import { uploadFile, generateFileKey } from './storage.js'
import { executeFFmpeg } from './ffmpeg-executor.js'
import { downloadToTemp, createTempPath, cleanupFiles } from './ffmpeg-file-manager.js'
import { getVideoDuration } from './video-probe.js'

export interface CompositionClip {
  videoUrl: string
  startTime: number
  endTime: number
  transition?: string
}

export interface CompositionOptions {
  segments: CompositionClip[]
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

export { getVideoDuration }

/**
 * Trim a video file
 */
async function trimVideo(
  inputPath: string,
  outputPath: string,
  start: number,
  duration: number
): Promise<void> {
  const result = await executeFFmpeg([
    '-i',
    inputPath,
    '-ss',
    start.toString(),
    '-t',
    duration.toString(),
    '-c',
    'copy',
    '-avoid_negative_ts',
    'make_zero',
    outputPath
  ])

  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg trim failed: ${result.stderr}`)
  }
}

/**
 * Add audio track (voiceover or BGM) to video
 */
async function addAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  type: 'voiceover' | 'bgm'
): Promise<void> {
  const audioVolume = type === 'voiceover' ? '1.0' : '0.3'

  const result = await executeFFmpeg([
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-filter_complex',
    `[1:a]volume=${audioVolume}[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    outputPath
  ])

  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg add audio failed: ${result.stderr}`)
  }
}

/**
 * Escape a file path for use inside FFmpeg's subtitles filter.
 * FFmpeg uses single quotes around the path, and requires escaping:
 *   ' -> '\''  (end quote, escaped quote, reopen quote)
 *   : and \ are passed as-is on Unix but we normalize backslashes
 */
function escapeSubtitlePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/')
  return normalized.replace(/'/g, "'\\''")
}

/**
 * Burn subtitles into video
 */
async function burnSubtitles(
  videoPath: string,
  subtitlePath: string,
  outputPath: string
): Promise<void> {
  const safePath = escapeSubtitlePath(subtitlePath)
  const result = await executeFFmpeg([
    '-i',
    videoPath,
    '-vf',
    `subtitles='${safePath}'`,
    '-c:a',
    'copy',
    outputPath
  ])

  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg burn subtitles failed: ${result.stderr}`)
  }
}

/**
 * Merge multiple video segments using FFmpeg
 */
async function mergeSegments(segments: CompositionClip[], outputPath: string): Promise<void> {
  const listFile = createTempPath('concat_list', '.txt')
  let listContent = ''
  const tempFiles: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const tempFile = await downloadToTemp(segment.videoUrl)
    tempFiles.push(tempFile)
    const startTime = segment.startTime || 0
    let duration = segment.endTime - startTime
    if (!Number.isFinite(duration) || duration <= 0) {
      const full = await getVideoDuration(tempFile)
      duration = Math.max(0.1, full - startTime)
    }

    const trimmedFile = createTempPath(`trim_${i}`, '.mp4')
    tempFiles.push(trimmedFile)
    await trimVideo(tempFile, trimmedFile, startTime, duration)
    listContent += `file '${trimmedFile}'\n`
  }

  await fs.writeFile(listFile, listContent)

  const result = await executeFFmpeg([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-c',
    'copy',
    outputPath
  ])

  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg concat failed: ${result.stderr}`)
  }

  await cleanupFiles([...tempFiles, listFile])
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

  const mergedVideo = createTempPath('merged', `.${outputFormat}`)
  const withAudio = createTempPath('audio', `.${outputFormat}`)
  const withSubs = createTempPath('subs', `.${outputFormat}`)
  const finalOutput = createTempPath('final', `.${outputFormat}`)
  const cleanupList: string[] = []

  try {
    // Step 1: Merge segments
    await mergeSegments(segments, mergedVideo)
    cleanupList.push(mergedVideo)

    let currentVideo = mergedVideo

    // Step 2: Add voiceover if provided
    if (voiceoverUrl) {
      await addAudio(currentVideo, voiceoverUrl, withAudio, 'voiceover')
      cleanupList.push(withAudio)
      currentVideo = withAudio
    }

    // Step 3: Add BGM if provided
    if (bgmUrl) {
      const withBgm = createTempPath('bgm', `.${outputFormat}`)
      cleanupList.push(withBgm)
      await addAudio(currentVideo, bgmUrl, withBgm, 'bgm')
      currentVideo = withBgm
    }

    // Step 4: Burn subtitles if provided
    if (subtitlesUrl) {
      await burnSubtitles(currentVideo, subtitlesUrl, withSubs)
      cleanupList.push(withSubs)
      currentVideo = withSubs
    }

    // Step 5: Scale to output resolution if needed
    if (currentVideo !== finalOutput) {
      const result = await executeFFmpeg([
        '-i',
        currentVideo,
        '-vf',
        `scale=${outputWidth}:${outputHeight}`,
        '-c:a',
        'copy',
        finalOutput
      ])

      if (result.exitCode !== 0) {
        throw new Error(`FFmpeg scale failed: ${result.stderr}`)
      }
      cleanupList.push(finalOutput)
    }

    // Step 6: Upload to storage
    const videoBuffer = await fs.readFile(finalOutput)
    const key = generateFileKey('videos', `composition_${Date.now()}.${outputFormat}`)
    const outputUrl = await uploadFile('videos', key, videoBuffer, `video/${outputFormat}`)

    // Get final duration
    const duration = await getVideoDuration(finalOutput)

    return {
      outputUrl,
      duration,
      width: outputWidth,
      height: outputHeight
    }
  } finally {
    // Cleanup temp files
    await cleanupFiles(cleanupList)
  }
}
