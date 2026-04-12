import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before importing the module
vi.mock('../src/index.js', () => ({
  prisma: {
    modelApiCall: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

import { logApiCall, updateApiCall, getApiCalls } from '../src/services/api-logger.js'
import { prisma } from '../src/index.js'

describe('ApiLogger Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('logApiCall', () => {
    it('should create api call log with all fields', async () => {
      const params = {
        userId: 'user-1',
        model: 'seedance2.0',
        provider: 'volcengine',
        prompt: 'A beautiful sunset',
        requestParams: { imageUrls: ['https://example.com/img.jpg'], duration: 5 },
        takeId: 'task-1'
      }

      const expectedLog = {
        id: 'log-1',
        userId: 'user-1',
        model: 'seedance2.0',
        provider: 'volcengine',
        prompt: 'A beautiful sunset',
        requestParams: JSON.stringify(params.requestParams),
        externalTaskId: null,
        status: 'processing',
        responseData: null,
        cost: null,
        duration: null,
        errorMsg: null,
        takeId: 'task-1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prisma.modelApiCall.create.mockResolvedValue(expectedLog)

      const result = await logApiCall(params)

      expect(prisma.modelApiCall.create).toHaveBeenCalled()
      expect(result.id).toBe('log-1')
    })

    it('should set status to failed when result has error', async () => {
      const params = {
        userId: 'user-1',
        model: 'seedance2.0',
        provider: 'volcengine',
        prompt: 'Test'
      }

      const result = {
        error: 'API rate limit exceeded'
      }

      const expectedLog = {
        id: 'log-3',
        userId: 'user-1',
        model: 'seedance2.0',
        provider: 'volcengine',
        prompt: 'Test',
        status: 'failed',
        errorMsg: 'API rate limit exceeded',
        takeId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prisma.modelApiCall.create.mockResolvedValue(expectedLog)

      await logApiCall(params, result)

      const callData = prisma.modelApiCall.create.mock.calls[0][0]
      expect(callData.data.status).toBe('failed')
    })

    it('should set status to completed when result has videoUrl', async () => {
      const params = {
        userId: 'user-1',
        model: 'seedance2.0',
        provider: 'volcengine',
        prompt: 'Test'
      }

      const apiCallResult = {
        videoUrl: 'https://cdn.example.com/video.mp4',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        cost: 0.5,
        duration: 5
      }

      const expectedLog = {
        id: 'log-4',
        userId: 'user-1',
        model: 'seedance2.0',
        provider: 'volcengine',
        prompt: 'Test',
        status: 'completed',
        responseData: JSON.stringify({ videoUrl: apiCallResult.videoUrl, thumbnailUrl: apiCallResult.thumbnailUrl }),
        cost: 0.5,
        duration: 5,
        takeId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prisma.modelApiCall.create.mockResolvedValue(expectedLog)

      await logApiCall(params, apiCallResult)

      const callData = prisma.modelApiCall.create.mock.calls[0][0]
      expect(callData.data.status).toBe('completed')
    })
  })

  describe('updateApiCall', () => {
    it('should update api call with all fields', async () => {
      const externalTaskId = 'ext-task-123'
      const update = {
        status: 'completed',
        responseData: { videoUrl: 'https://example.com/video.mp4' },
        cost: 0.7,
        duration: 5
      }

      prisma.modelApiCall.updateMany.mockResolvedValue({ count: 1 })

      await updateApiCall(externalTaskId, update)

      expect(prisma.modelApiCall.updateMany).toHaveBeenCalledWith({
        where: { externalTaskId },
        data: {
          status: 'completed',
          responseData: JSON.stringify({ videoUrl: 'https://example.com/video.mp4' }),
          cost: 0.7,
          duration: 5
        }
      })
    })

    it('should handle partial updates', async () => {
      const externalTaskId = 'ext-task-456'
      const update = {
        status: 'failed',
        errorMsg: 'Timeout error'
      }

      prisma.modelApiCall.updateMany.mockResolvedValue({ count: 1 })

      await updateApiCall(externalTaskId, update)

      expect(prisma.modelApiCall.updateMany).toHaveBeenCalledWith({
        where: { externalTaskId },
        data: {
          status: 'failed',
          errorMsg: 'Timeout error'
        }
      })
    })
  })

  describe('getApiCalls', () => {
    it('should fetch api calls for user', async () => {
      const userId = 'user-1'
      const mockLogs = [
        { id: 'log-1', model: 'seedance2.0', prompt: 'Test 1' },
        { id: 'log-2', model: 'wan2.6', prompt: 'Test 2' }
      ]

      prisma.modelApiCall.findMany.mockResolvedValue(mockLogs)

      const result = await getApiCalls(userId)

      expect(prisma.modelApiCall.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0
      })
      expect(result).toEqual(mockLogs)
    })

    it('should filter by model', async () => {
      const userId = 'user-1'
      const model = 'seedance2.0'

      prisma.modelApiCall.findMany.mockResolvedValue([])

      await getApiCalls(userId, { model })

      expect(prisma.modelApiCall.findMany).toHaveBeenCalledWith({
        where: { userId, model: 'seedance2.0' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0
      })
    })

    it('should handle pagination options', async () => {
      const userId = 'user-1'

      prisma.modelApiCall.findMany.mockResolvedValue([])

      await getApiCalls(userId, { limit: 10, offset: 20 })

      expect(prisma.modelApiCall.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20
      })
    })
  })
})
