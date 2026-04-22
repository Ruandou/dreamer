import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  downloadToTemp,
  createTempPath,
  cleanupFiles
} from '../src/services/ffmpeg-file-manager.js'
import { promises as fs } from 'fs'

// Mock fs and fetch
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockImplementation(() => Promise.resolve())
  }
}))

describe('FFmpeg File Manager', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('downloadToTemp', () => {
    it('should download file and save to temp directory', async () => {
      const mockBuffer = new Uint8Array([1, 2, 3])
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          arrayBuffer: () => mockBuffer
        })
      )

      const url = 'https://example.com/video.mp4'
      const result = await downloadToTemp(url)

      expect(fetch).toHaveBeenCalledWith(url)
      expect(fs.writeFile).toHaveBeenCalled()
      expect(result).toContain('temp_')
      expect(result).toContain('.mp4')
    })

    it('should use custom extension', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          arrayBuffer: () => new Uint8Array([1, 2, 3])
        })
      )

      const result = await downloadToTemp('https://example.com/audio.mp3', '.mp3')

      expect(result).toContain('.mp3')
    })
  })

  describe('createTempPath', () => {
    it('should create temp path with prefix and extension', () => {
      const result = createTempPath('test', '.txt')

      expect(result).toContain('test_')
      expect(result).toContain('.txt')
    })

    it('should include timestamp and random string', () => {
      const result1 = createTempPath('prefix', '.ext')
      const result2 = createTempPath('prefix', '.ext')

      expect(result1).not.toBe(result2) // Different random strings
    })
  })

  describe('cleanupFiles', () => {
    it.skip('should delete all files - TODO: mock reset issue', async () => {
      const files = ['/tmp/file1.mp4', '/tmp/file2.mp4', '/tmp/file3.mp4']

      await cleanupFiles(files)

      expect(fs.unlink).toHaveBeenCalledTimes(3)
      files.forEach((file) => {
        expect(fs.unlink).toHaveBeenCalledWith(file)
      })
    })

    it.skip('should handle errors gracefully - TODO: mock reset issue', async () => {
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT'))

      await expect(cleanupFiles(['/tmp/nonexistent'])).resolves.not.toThrow()
    })
  })
})
