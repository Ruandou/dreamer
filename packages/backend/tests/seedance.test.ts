import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock environment variables
process.env.VOLC_ACCESS_KEY = 'test-access-key'
process.env.VOLC_SECRET_KEY = 'test-secret-key'
process.env.VOLC_API_URL = 'https://api.volc.example.com'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import after mocks
import {
  submitSeedanceTask,
  pollSeedanceStatus,
  waitForSeedanceCompletion,
  calculateSeedanceCost,
  type SeedanceGenerateRequest,
  type SeedanceStatusResponse
} from '../src/services/seedance.js'

describe('Seedance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateSeedanceCost', () => {
    it('should calculate cost correctly for 5 second video', () => {
      const cost = calculateSeedanceCost(5)

      // 5 seconds * 1 yuan/sec * 0.14 CNY to USD = 0.7 USD
      expect(cost).toBeCloseTo(0.7)
    })

    it('should calculate cost correctly for 10 second video', () => {
      const cost = calculateSeedanceCost(10)

      expect(cost).toBeCloseTo(1.4)
    })
  })

  describe('submitSeedanceTask', () => {
    it('should submit task successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-123',
          status: 'queued'
        })
      })

      const request: SeedanceGenerateRequest = {
        prompt: 'test prompt',
        duration: 5
      }

      const response = await submitSeedanceTask(request)

      expect(response.taskId).toBe('task-123')
      expect(response.status).toBe('queued')
    })

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request'
      })

      const request: SeedanceGenerateRequest = {
        prompt: 'test prompt'
      }

      await expect(submitSeedanceTask(request)).rejects.toThrow('Seedance 2.0 API error')
    })
  })

  describe('pollSeedanceStatus', () => {
    it('should return status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-123',
          status: 'processing'
        })
      })

      const response = await pollSeedanceStatus('task-123')

      expect(response.taskId).toBe('task-123')
      expect(response.status).toBe('processing')
    })

    it('should return completed status with video URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          taskId: 'task-123',
          status: 'completed',
          videoUrl: 'https://example.com/video.mp4',
          thumbnailUrl: 'https://example.com/thumb.jpg'
        })
      })

      const response = await pollSeedanceStatus('task-123')

      expect(response.status).toBe('completed')
      expect(response.videoUrl).toBe('https://example.com/video.mp4')
    })

    it('should throw error when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Task not found'
      })

      await expect(pollSeedanceStatus('task-123')).rejects.toThrow('Seedance 2.0 API error')
    })
  })

  describe('waitForSeedanceCompletion', () => {
    it('should return when task is completed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task-123', status: 'completed', videoUrl: 'https://example.com/video.mp4' })
      })

      const response = await waitForSeedanceCompletion('task-123', 60000)

      expect(response.status).toBe('completed')
      expect(response.videoUrl).toBe('https://example.com/video.mp4')
    })

    it('should throw error when task fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: 'task-123', status: 'failed', error: 'Processing error' })
      })

      await expect(waitForSeedanceCompletion('task-123', 60000)).rejects.toThrow('Seedance 2.0 task failed: Processing error')
    })
  })
})
