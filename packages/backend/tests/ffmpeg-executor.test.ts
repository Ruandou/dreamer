import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeFFmpeg, executeFFprobe, type ExecResult } from '../src/services/ffmpeg-executor.js'

// Mock child_process
const mockSpawn = vi.fn()
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args)
}))

describe('FFmpeg Executor', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('executeFFmpeg', () => {
    it('should execute ffmpeg command and return result on success', async () => {
      const mockProcess = {
        stdout: { on: vi.fn((event, cb) => event === 'data' && cb('output')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await executeFFmpeg(['-i', 'input.mp4', 'output.mp4'])

      expect(result).toEqual({
        exitCode: 0,
        stdout: 'output',
        stderr: ''
      })
      expect(mockSpawn).toHaveBeenCalledWith(expect.stringContaining('ffmpeg'), [
        '-i',
        'input.mp4',
        'output.mp4'
      ])
    })

    it('should return non-zero exit code on failure', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((event, cb) => event === 'data' && cb('error message')) },
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(1)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await executeFFmpeg(['-invalid'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBe('error message')
    })

    it('should reject on process error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === 'error') cb(new Error('spawn failed'))
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      await expect(executeFFmpeg(['test'])).rejects.toThrow('spawn failed')
    })
  })

  describe('executeFFprobe', () => {
    it('should execute ffprobe command', async () => {
      const mockProcess = {
        stdout: { on: vi.fn((event, cb) => event === 'data' && cb('10.5')) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(0)
        })
      }
      mockSpawn.mockReturnValue(mockProcess)

      const result = await executeFFprobe(['-v', 'error', 'video.mp4'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('10.5')
      expect(mockSpawn).toHaveBeenCalledWith(expect.stringContaining('ffprobe'), [
        '-v',
        'error',
        'video.mp4'
      ])
    })
  })
})
