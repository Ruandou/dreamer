import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Suppress console.error/warn for cleaner test output
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

const {
  mockTakeFindUnique,
  mockTakeUpdate,
  mockSceneUpdate,
  mockUploadFile,
  mockGenerateFileKey,
  mockSendTaskUpdate,
  mockWorkerOn,
  mockWorkerClose,
  mockQueueClose,
  mockLogApiCall,
  mockUpdateApiCall,
  capturedProcessor,
  mockProvider
} = vi.hoisted(() => ({
  mockTakeFindUnique: vi.fn(),
  mockTakeUpdate: vi.fn(),
  mockSceneUpdate: vi.fn(),
  mockUploadFile: vi.fn(),
  mockGenerateFileKey: vi.fn(),
  mockSendTaskUpdate: vi.fn(),
  mockWorkerOn: vi.fn(),
  mockWorkerClose: vi.fn().mockResolvedValue(undefined),
  mockQueueClose: vi.fn().mockResolvedValue(undefined),
  mockLogApiCall: vi.fn(),
  mockUpdateApiCall: vi.fn(),
  capturedProcessor: { current: null as ((job: any) => Promise<any>) | null },
  mockProvider: {
    name: 'atlas',
    submitGeneration: vi.fn(),
    queryStatus: vi.fn()
  }
}))

vi.mock('ioredis', () => {
  const mRedis = {
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnThis()
  }
  return { default: vi.fn(() => mRedis) }
})

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    close: mockQueueClose,
    on: vi.fn()
  })),
  Worker: vi.fn().mockImplementation((_name: string, processor: (job: any) => Promise<any>) => {
    capturedProcessor.current = processor
    return {
      on: mockWorkerOn,
      close: mockWorkerClose
    }
  })
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    take: {
      findUnique: mockTakeFindUnique,
      update: mockTakeUpdate
    },
    scene: {
      update: mockSceneUpdate
    },
    modelApiCall: {
      create: vi.fn().mockResolvedValue({ id: 'api-call-123' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

vi.mock('../src/plugins/sse.js', () => ({
  sendTaskUpdate: mockSendTaskUpdate
}))

vi.mock('../src/services/ai/video/video-factory.js', () => ({
  getVideoProviderForUser: vi.fn().mockResolvedValue(mockProvider),
  getDefaultVideoProvider: vi.fn().mockResolvedValue(mockProvider),
  calculateSeedanceCost: vi.fn().mockReturnValue(1.0),
  calculateWan26Cost: vi.fn().mockReturnValue(0.5)
}))

vi.mock('../src/services/storage.js', () => ({
  uploadFile: mockUploadFile,
  generateFileKey: mockGenerateFileKey
}))

vi.mock('../src/services/ai/api-logger.js', () => ({
  logApiCall: mockLogApiCall,
  updateApiCall: mockUpdateApiCall
}))

global.fetch = vi.fn()

import { videoQueue, videoWorker } from '../src/queues/video.js'

const defaultTake = {
  id: 'task-123',
  scene: {
    id: 'scene-123',
    episode: {
      id: 'episode-123',
      project: {
        id: 'project-123',
        userId: 'user-123'
      }
    }
  }
}

describe('Video Queue Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTakeFindUnique.mockResolvedValue(defaultTake)
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      headers: { get: () => 'image/jpeg' }
    })

    // Set up mock provider defaults
    mockProvider.submitGeneration.mockResolvedValue({ taskId: 'ext-task-123', status: 'queued' })
    mockProvider.queryStatus.mockResolvedValue({
      taskId: 'ext-task-123',
      status: 'completed',
      videoUrl: 'https://cdn.example.com/video.mp4',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg'
    })
  })

  describe('Queue and Worker exports', () => {
    it('should export videoQueue', () => {
      expect(videoQueue).toBeDefined()
    })

    it('should export videoWorker', () => {
      expect(videoWorker).toBeDefined()
    })
  })

  describe('Worker processor', () => {
    it('should process wan2.6 job successfully', async () => {
      mockUploadFile.mockResolvedValue('https://minio.example.com/videos/task-123.mp4')
      mockGenerateFileKey.mockReturnValue('videos/task-123.mp4')
      mockLogApiCall.mockResolvedValue({ id: 'api-call-123' })

      const mockJob = {
        id: 'job-1',
        data: {
          sceneId: 'scene-123',
          taskId: 'task-123',
          prompt: 'A person walking',
          model: 'wan2.6',
          duration: 5
        }
      }

      if (capturedProcessor.current) {
        await capturedProcessor.current(mockJob)
      }

      expect(mockTakeUpdate).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: { status: 'processing' }
      })
      expect(mockProvider.submitGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A person walking',
          duration: 5,
          aspectRatio: '9:16'
        })
      )
      expect(mockProvider.queryStatus).toHaveBeenCalledWith('ext-task-123')
      expect(mockUploadFile).toHaveBeenCalled()
    })

    it('should process seedance2.0 job successfully', async () => {
      mockUploadFile.mockResolvedValue('https://minio.example.com/videos/task-123.mp4')
      mockGenerateFileKey.mockReturnValue('videos/task-123.mp4')
      mockLogApiCall.mockResolvedValue({ id: 'api-call-456' })

      const mockJob = {
        id: 'job-2',
        data: {
          sceneId: 'scene-456',
          taskId: 'task-456',
          prompt: 'A car driving',
          model: 'seedance2.0',
          duration: 10
        }
      }

      if (capturedProcessor.current) {
        await capturedProcessor.current(mockJob)
      }

      expect(mockProvider.submitGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A car driving',
          duration: 10,
          aspectRatio: '9:16'
        })
      )
      expect(mockProvider.queryStatus).toHaveBeenCalledWith('ext-task-123')
    })

    it('should use default duration when not provided', async () => {
      mockUploadFile.mockResolvedValue('https://minio.example.com/videos/task-123.mp4')
      mockGenerateFileKey.mockReturnValue('videos/task-123.mp4')

      const mockJob = {
        id: 'job-3',
        data: {
          sceneId: 'scene-789',
          taskId: 'task-789',
          prompt: 'A cat sleeping',
          model: 'wan2.6'
        }
      }

      if (capturedProcessor.current) {
        await capturedProcessor.current(mockJob)
      }

      expect(mockProvider.submitGeneration).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 5 })
      )
    })

    it('should send SSE notification on processing', async () => {
      mockUploadFile.mockResolvedValue('https://minio.example.com/videos/task-123.mp4')
      mockGenerateFileKey.mockReturnValue('videos/task-123.mp4')

      const mockJob = {
        id: 'job-4',
        data: {
          sceneId: 'scene-111',
          taskId: 'task-111',
          prompt: 'Test prompt',
          model: 'wan2.6'
        }
      }

      if (capturedProcessor.current) {
        await capturedProcessor.current(mockJob)
      }

      expect(mockSendTaskUpdate).toHaveBeenCalledWith('user-123', 'task-111', 'processing', {
        sceneId: 'scene-111'
      })
    })

    it('should handle job failure', async () => {
      mockProvider.submitGeneration.mockRejectedValue(new Error('API Error'))
      mockTakeUpdate.mockResolvedValue({ id: 'task-123' })

      const mockJob = {
        id: 'job-5',
        data: {
          sceneId: 'scene-222',
          taskId: 'task-222',
          prompt: 'Test prompt',
          model: 'wan2.6'
        }
      }

      if (capturedProcessor.current) {
        await expect(capturedProcessor.current(mockJob)).rejects.toThrow('API Error')
      }

      expect(mockTakeUpdate).toHaveBeenCalledWith({
        where: { id: 'task-222' },
        data: expect.objectContaining({ status: 'failed' })
      })
    })
  })
})
