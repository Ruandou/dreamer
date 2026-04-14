import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock environment variables
process.env.ATLAS_API_KEY = 'test-api-key'
process.env.ATLAS_API_URL = 'https://api.atlascloud.com'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import after mocks
import {
  submitWan26Task,
  pollWan26Status,
  waitForWan26Completion,
  calculateWan26Cost,
  type Wan26GenerateRequest
} from '../src/services/ai/wan26.js'

describe('Wan26 Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateWan26Cost', () => {
    it('should calculate cost correctly for 5 second video', () => {
      const cost = calculateWan26Cost(5)

      // 5 seconds * 0.07 per second = 0.35
      expect(cost).toBeCloseTo(0.35)
    })

    it('should calculate cost correctly for 10 second video', () => {
      const cost = calculateWan26Cost(10)

      expect(cost).toBeCloseTo(0.7)
    })
  })

  describe('submitWan26Task', () => {
    it('should submit task successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-456',
          status: 'queued'
        })
      })

      const request: Wan26GenerateRequest = {
        prompt: 'test prompt',
        duration: 5
      }

      const response = await submitWan26Task(request)

      expect(response.taskId).toBe('task-456')
      expect(response.status).toBe('queued')
    })

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request'
      })

      const request: Wan26GenerateRequest = {
        prompt: 'test prompt'
      }

      await expect(submitWan26Task(request)).rejects.toThrow('Wan 2.6 API error')
    })
  })

  describe('pollWan26Status', () => {
    it('should return status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-456',
          status: 'processing'
        })
      })

      const response = await pollWan26Status('task-456')

      expect(response.taskId).toBe('task-456')
      expect(response.status).toBe('processing')
    })

    it('should return completed status with video URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-456',
          status: 'completed',
          videoUrl: 'https://example.com/video.mp4',
          thumbnailUrl: 'https://example.com/thumb.jpg'
        })
      })

      const response = await pollWan26Status('task-456')

      expect(response.status).toBe('completed')
      expect(response.videoUrl).toBe('https://example.com/video.mp4')
    })

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Task not found'
      })

      await expect(pollWan26Status('task-456')).rejects.toThrow('Wan 2.6 API error')
    })
  })

  describe('waitForWan26Completion', () => {
    it('should return when task is completed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-456',
          status: 'completed',
          videoUrl: 'https://example.com/video.mp4'
        })
      })

      const response = await waitForWan26Completion('task-456', 60000)

      expect(response.status).toBe('completed')
      expect(response.videoUrl).toBe('https://example.com/video.mp4')
    })

    it('should throw error when task fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-456',
          status: 'failed',
          error: 'Processing error'
        })
      })

      await expect(waitForWan26Completion('task-456', 60000)).rejects.toThrow('Wan 2.6 task failed: Processing error')
    })
  })
})
