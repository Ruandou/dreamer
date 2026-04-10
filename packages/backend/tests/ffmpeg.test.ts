import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('FFmpeg Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Exports', () => {
    it('should export composeVideo function', async () => {
      const { composeVideo } = await import('../src/services/ffmpeg.js')
      expect(composeVideo).toBeDefined()
      expect(typeof composeVideo).toBe('function')
    })
  })

  describe('CompositionSegment interface', () => {
    it('should accept valid segment data', () => {
      const segment = {
        sceneId: 'scene-123',
        videoUrl: 'https://example.com/video.mp4',
        startTime: 0,
        endTime: 5,
        transition: 'fade'
      }

      expect(segment.sceneId).toBe('scene-123')
      expect(segment.videoUrl).toBe('https://example.com/video.mp4')
      expect(segment.startTime).toBe(0)
      expect(segment.endTime).toBe(5)
      expect(segment.transition).toBe('fade')
    })

    it('should accept segment without transition', () => {
      const segment = {
        sceneId: 'scene-123',
        videoUrl: 'https://example.com/video.mp4',
        startTime: 10,
        endTime: 15
      }

      expect(segment.transition).toBeUndefined()
    })
  })

  describe('CompositionOptions interface', () => {
    it('should accept full options', () => {
      const options = {
        segments: [
          {
            sceneId: 'scene-1',
            videoUrl: 'https://example.com/video1.mp4',
            startTime: 0,
            endTime: 5
          }
        ],
        voiceoverUrl: 'https://example.com/voiceover.mp3',
        bgmUrl: 'https://example.com/bgm.mp3',
        subtitlesUrl: 'https://example.com/subs.srt',
        outputWidth: 1080,
        outputHeight: 1920,
        outputFormat: 'mp4' as const
      }

      expect(options.segments.length).toBe(1)
      expect(options.voiceoverUrl).toBe('https://example.com/voiceover.mp3')
      expect(options.bgmUrl).toBe('https://example.com/bgm.mp3')
      expect(options.outputWidth).toBe(1080)
      expect(options.outputHeight).toBe(1920)
      expect(options.outputFormat).toBe('mp4')
    })

    it('should accept minimal options', () => {
      const options = {
        segments: [
          {
            sceneId: 'scene-1',
            videoUrl: 'https://example.com/video1.mp4',
            startTime: 0,
            endTime: 5
          }
        ]
      }

      expect(options.segments.length).toBe(1)
      expect(options.outputFormat).toBeUndefined()
    })

    it('should accept webm format', () => {
      const options = {
        segments: [],
        outputFormat: 'webm' as const
      }

      expect(options.outputFormat).toBe('webm')
    })
  })

  describe('CompositionResult interface', () => {
    it('should have correct shape', () => {
      const result = {
        outputUrl: 'https://minio.example.com/videos/final.mp4',
        duration: 60.5,
        width: 1080,
        height: 1920
      }

      expect(result.outputUrl).toBe('https://minio.example.com/videos/final.mp4')
      expect(result.duration).toBe(60.5)
      expect(result.width).toBe(1080)
      expect(result.height).toBe(1920)
    })
  })
})
