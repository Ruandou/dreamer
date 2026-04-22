import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getVideoDuration } from '../src/services/video-probe.js'
import * as executor from '../src/services/ffmpeg-executor.js'

vi.mock('../src/services/ffmpeg-executor.js')

describe('Video Probe', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getVideoDuration', () => {
    it('should return video duration from ffprobe', async () => {
      vi.mocked(executor.executeFFprobe).mockResolvedValue({
        exitCode: 0,
        stdout: '10.5',
        stderr: ''
      })

      const duration = await getVideoDuration('/tmp/video.mp4')

      expect(duration).toBe(10.5)
      expect(executor.executeFFprobe).toHaveBeenCalledWith([
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        '/tmp/video.mp4'
      ])
    })

    it('should return 0 for invalid duration', async () => {
      vi.mocked(executor.executeFFprobe).mockResolvedValue({
        exitCode: 0,
        stdout: 'invalid',
        stderr: ''
      })

      const duration = await getVideoDuration('/tmp/video.mp4')

      expect(duration).toBe(0)
    })

    it('should throw error when ffprobe fails', async () => {
      vi.mocked(executor.executeFFprobe).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'file not found'
      })

      await expect(getVideoDuration('/tmp/nonexistent.mp4')).rejects.toThrow(
        'ffprobe failed: file not found'
      )
    })
  })
})
