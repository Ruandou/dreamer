import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

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

// Mock AI services
const mockSubmitWan26Task = vi.fn()
const mockWaitForWan26Completion = vi.fn()
const mockCalculateWan26Cost = vi.fn()

vi.mock('../src/services/ai/wan26.js', () => ({
  submitWan26Task: mockSubmitWan26Task,
  waitForWan26Completion: mockWaitForWan26Completion,
  calculateWan26Cost: mockCalculateWan26Cost
}))

const mockSubmitSeedanceTask = vi.fn()
const mockWaitForSeedanceCompletion = vi.fn()
const mockCalculateSeedanceCost = vi.fn()
const mockImageUrlsToBase64 = vi.fn()

vi.mock('../src/services/ai/seedance.js', () => ({
  submitSeedanceTask: mockSubmitSeedanceTask,
  waitForSeedanceCompletion: mockWaitForSeedanceCompletion,
  calculateSeedanceCost: mockCalculateSeedanceCost,
  imageUrlsToBase64: mockImageUrlsToBase64
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
  beforeAll(async () => {
    await import('../src/queues/video.js')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process Wan 2.6 video generation successfully', async () => {
    // Import to trigger worker registration
    await import('../src/queues/video.js')
    
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
    mockSubmitWan26Task.mockResolvedValue({ taskId: 'wan-task-123' })
    mockWaitForWan26Completion.mockResolvedValue({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg'
    })
    mockCalculateWan26Cost.mockReturnValue(0.05)
    mockUploadFile.mockResolvedValue('https://storage.example.com/video.mp4')
    mockGenerateFileKey.mockReturnValue('videos/user-1/video.mp4')

    // Execute worker
    const result = await capturedVideoProcessor(mockJob)

    // Verify service calls
    expect(mockGetProjectUserIdForTask).toHaveBeenCalledWith('task-1')
    expect(mockSetTaskProcessing).toHaveBeenCalledWith('task-1')
    expect(mockSendTaskUpdate).toHaveBeenCalledWith('user-1', 'task-1', 'processing', { sceneId: 'scene-1' })
    expect(mockSetSceneGenerating).toHaveBeenCalledWith('scene-1')
    expect(mockSubmitWan26Task).toHaveBeenCalledWith({
      prompt: 'A person walking',
      referenceImage: undefined,
      duration: 5
    })
    expect(mockSetTaskExternalTaskId).toHaveBeenCalledWith('task-1', 'wan-task-123')
    expect(mockWaitForWan26Completion).toHaveBeenCalledWith('wan-task-123')
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
    mockSubmitSeedanceTask.mockResolvedValue({ taskId: 'seedance-task-123' })
    mockWaitForSeedanceCompletion.mockResolvedValue({
      videoUrl: 'https://example.com/seedance-video.mp4'
    })
    mockCalculateSeedanceCost.mockReturnValue(0.08)

    await capturedVideoProcessor(mockJob)

    expect(mockSubmitSeedanceTask).toHaveBeenCalledWith({
      prompt: 'A person running',
      imageBase64: undefined,
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
    mockSubmitWan26Task.mockRejectedValue(new Error('API rate limit exceeded'))

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
    mockSubmitWan26Task.mockResolvedValue({ taskId: 'wan-task-456' })
    mockWaitForWan26Completion.mockResolvedValue({
      videoUrl: null
    })

    await expect(capturedVideoProcessor(mockJob)).rejects.toThrow('Wan 2.6 returned no video URL')
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
    mockSubmitWan26Task.mockResolvedValue({ taskId: 'wan-task-789' })
    mockWaitForWan26Completion.mockResolvedValue({
      videoUrl: 'https://example.com/video.mp4'
    })

    await capturedVideoProcessor(mockJob)

    expect(mockSubmitWan26Task).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      referenceImage: undefined,
      duration: 5 // Default duration
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
    mockSubmitWan26Task.mockResolvedValue({ taskId: 'wan-task-999' })
    mockWaitForWan26Completion.mockResolvedValue({
      videoUrl: 'https://example.com/video.mp4'
    })

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
    mockImageUrlsToBase64.mockResolvedValue(['base64-1', 'base64-2'])
    mockSubmitSeedanceTask.mockResolvedValue({ taskId: 'seedance-task-999' })
    mockWaitForSeedanceCompletion.mockResolvedValue({
      videoUrl: 'https://example.com/video.mp4'
    })

    await capturedVideoProcessor(mockJob)

    expect(mockImageUrlsToBase64).toHaveBeenCalledWith([
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg'
    ])
  })
})
