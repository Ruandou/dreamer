import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'

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

// Mock ioredis before importing queue
vi.mock('ioredis', () => {
  const mRedis = {
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnThis()
  }
  return { default: vi.fn(() => mRedis) }
})

// Mock services
const mockSetTaskProcessing = vi.fn()
const mockSetSceneGenerating = vi.fn()
const mockSetTaskExternalTaskId = vi.fn()
const mockSetTaskCompleted = vi.fn()
const mockSetTaskFailed = vi.fn()
const mockSetSceneCompleted = vi.fn()
const mockSetSceneFailed = vi.fn()
const mockGetProjectUserIdForTask = vi.fn()

vi.mock('../src/services/video-queue-service.js', () => ({
  videoQueueService: {
    setTaskProcessing: mockSetTaskProcessing,
    setSceneGenerating: mockSetSceneGenerating,
    setTaskExternalTaskId: mockSetTaskExternalTaskId,
    setTaskCompleted: mockSetTaskCompleted,
    setTaskFailed: mockSetTaskFailed,
    setSceneCompleted: mockSetSceneCompleted,
    setSceneFailed: mockSetSceneFailed,
    getProjectUserIdForTask: mockGetProjectUserIdForTask
  }
}))

// Mock SSE
const mockSendTaskUpdate = vi.fn()
vi.mock('../src/plugins/sse.js', () => ({
  sendTaskUpdate: mockSendTaskUpdate
}))

// Mock video factory
const mockGetVideoProviderForUser = vi.fn()
const mockGetDefaultVideoProvider = vi.fn()

vi.mock('../src/services/ai/video/video-factory.js', () => ({
  getVideoProviderForUser: mockGetVideoProviderForUser,
  getDefaultVideoProvider: mockGetDefaultVideoProvider,
  calculateSeedanceCost: vi.fn().mockReturnValue(1.0),
  calculateWan26Cost: vi.fn().mockReturnValue(0.35)
}))

// Mock storage
const mockUploadFile = vi.fn()
const mockGenerateFileKey = vi.fn()

vi.mock('../src/services/storage.js', () => ({
  uploadFile: mockUploadFile,
  generateFileKey: mockGenerateFileKey
}))

// Mock API logger
const mockLogApiCall = vi.fn()
const mockUpdateApiCall = vi.fn()

vi.mock('../src/services/ai/api-logger.js', () => ({
  logApiCall: mockLogApiCall,
  updateApiCall: mockUpdateApiCall
}))

// Mock global fetch to avoid real network requests
const originalFetch = global.fetch
beforeAll(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { get: () => 'image/jpeg' }
    } as Response)
  )
})

afterAll(() => {
  global.fetch = originalFetch
})

// Mock BullMQ Worker to capture the processor function
let capturedVideoProcessor: Function
let capturedVideoWorkerOptions: any

vi.mock('bullmq', () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  }

  const MockWorker = vi.fn((name, processor, options) => {
    capturedVideoProcessor = processor
    capturedVideoWorkerOptions = options
    return {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    }
  })

  return {
    Queue: vi.fn(() => mockQueue),
    Worker: MockWorker
  }
})

describe('Video Queue Worker', () => {
  const mockProvider = {
    name: 'atlas',
    submitGeneration: vi.fn(),
    queryStatus: vi.fn()
  }

  beforeAll(async () => {
    await import('../src/queues/video.js')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock to avoid leaking call counts
    ;(global.fetch as any).mockClear?.()

    // Set up mock provider defaults
    mockProvider.submitGeneration.mockResolvedValue({ taskId: 'ext-task-123', status: 'queued' })
    mockProvider.queryStatus.mockResolvedValue({
      taskId: 'ext-task-123',
      status: 'completed',
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg'
    })
    mockGetVideoProviderForUser.mockResolvedValue(mockProvider)
    mockGetDefaultVideoProvider.mockResolvedValue(mockProvider)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process Wan 2.6 video generation successfully', async () => {
    expect(capturedVideoProcessor).toBeDefined()

    // Mock job data
    const mockJob = {
      id: 'job-123',
      data: {
        sceneId: 'scene-1',
        taskId: 'task-1',
        prompt: 'A person walking',
        model: 'wan2.6' as const,
        duration: 5
      }
    }

    // Mock service responses
    mockGetProjectUserIdForTask.mockResolvedValue('user-1')
    mockLogApiCall.mockResolvedValue({ id: 'api-call-1' })
    mockUploadFile.mockResolvedValue('https://storage.example.com/video.mp4')
    mockGenerateFileKey.mockReturnValue('videos/user-1/video.mp4')

    // Execute worker
    const result = await capturedVideoProcessor(mockJob)

    // Verify service calls
    expect(mockGetProjectUserIdForTask).toHaveBeenCalledWith('task-1')
    expect(mockSetTaskProcessing).toHaveBeenCalledWith('task-1')
    expect(mockSendTaskUpdate).toHaveBeenCalledWith('user-1', 'task-1', 'processing', {
      sceneId: 'scene-1'
    })
    expect(mockSetSceneGenerating).toHaveBeenCalledWith('scene-1')
    expect(mockProvider.submitGeneration).toHaveBeenCalledWith({
      prompt: 'A person walking',
      imageUrls: undefined,
      duration: 5,
      aspectRatio: '9:16'
    })
    expect(mockSetTaskExternalTaskId).toHaveBeenCalledWith('task-1', 'ext-task-123')
    expect(mockProvider.queryStatus).toHaveBeenCalledWith('ext-task-123')
    expect(mockSetTaskCompleted).toHaveBeenCalled()
    expect(mockSetSceneCompleted).toHaveBeenCalled()
    // Worker doesn't return a value
    expect(mockUploadFile).toHaveBeenCalled()
  })

  it('should process Seedance video generation successfully', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'job-124',
      data: {
        sceneId: 'scene-2',
        taskId: 'task-2',
        prompt: 'A person running',
        model: 'seedance2.0' as const,
        referenceImage: 'https://example.com/ref.jpg',
        duration: 10
      }
    }

    mockGetProjectUserIdForTask.mockResolvedValue('user-1')
    mockLogApiCall.mockResolvedValue({ id: 'api-call-2' })

    await capturedVideoProcessor(mockJob)

    expect(mockProvider.submitGeneration).toHaveBeenCalledWith({
      prompt: 'A person running',
      imageUrls: undefined,
      duration: 10,
      aspectRatio: '9:16' // Default value
    })
  })

  it('should handle Wan 2.6 API failure', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'job-125',
      data: {
        sceneId: 'scene-3',
        taskId: 'task-3',
        prompt: 'Test prompt',
        model: 'wan2.6' as const
      }
    }

    mockGetProjectUserIdForTask.mockResolvedValue('user-1')
    mockLogApiCall.mockResolvedValue({ id: 'api-call-3' })
    mockProvider.submitGeneration.mockRejectedValue(new Error('API rate limit exceeded'))

    await expect(capturedVideoProcessor(mockJob)).rejects.toThrow('API rate limit exceeded')

    expect(mockSetTaskFailed).toHaveBeenCalled()
    expect(mockSetSceneFailed).toHaveBeenCalled()
  })

  it('should handle empty video URL response', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'job-126',
      data: {
        sceneId: 'scene-4',
        taskId: 'task-4',
        prompt: 'Test prompt',
        model: 'wan2.6' as const
      }
    }

    mockGetProjectUserIdForTask.mockResolvedValue('user-1')
    mockLogApiCall.mockResolvedValue({ id: 'api-call-4' })
    mockProvider.queryStatus.mockResolvedValue({
      taskId: 'ext-task-456',
      status: 'completed',
      videoUrl: null
    })

    await expect(capturedVideoProcessor(mockJob)).rejects.toThrow('atlas returned no video URL')
  })

  it('should use default duration when not provided', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'job-127',
      data: {
        sceneId: 'scene-5',
        taskId: 'task-5',
        prompt: 'Test prompt',
        model: 'wan2.6' as const
      }
    }

    mockGetProjectUserIdForTask.mockResolvedValue('user-1')
    mockLogApiCall.mockResolvedValue({ id: 'api-call-5' })

    await capturedVideoProcessor(mockJob)

    expect(mockProvider.submitGeneration).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      imageUrls: undefined,
      duration: 5, // Default duration
      aspectRatio: '9:16'
    })
  })

  it('should handle missing userId gracefully', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'job-128',
      data: {
        sceneId: 'scene-6',
        taskId: 'task-6',
        prompt: 'Test prompt',
        model: 'wan2.6' as const
      }
    }

    mockGetProjectUserIdForTask.mockResolvedValue(null)

    await capturedVideoProcessor(mockJob)

    // Should not call sendTaskUpdate when userId is null
    expect(mockSendTaskUpdate).not.toHaveBeenCalled()
    expect(mockLogApiCall).not.toHaveBeenCalled()
  })

  it('should handle Seedance with multiple image URLs', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'job-129',
      data: {
        sceneId: 'scene-7',
        taskId: 'task-7',
        prompt: 'Test prompt',
        model: 'seedance2.0' as const,
        imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        duration: 8
      }
    }

    mockGetProjectUserIdForTask.mockResolvedValue('user-1')
    mockLogApiCall.mockResolvedValue({ id: 'api-call-6' })

    await capturedVideoProcessor(mockJob)

    // The worker converts image URLs to base64 internally via fetch
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/img1.jpg')
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/img2.jpg')
    expect(mockProvider.submitGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Test prompt',
        duration: 8,
        aspectRatio: '9:16'
      })
    )
  })
})
