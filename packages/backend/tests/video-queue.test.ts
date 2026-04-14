import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock ioredis
vi.mock('ioredis', () => {
  const mRedis = {
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnThis()
  }
  return { default: vi.fn(() => mRedis) }
})

// Mock bullmq
vi.mock('bullmq', () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  }
  const mockWorker = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }
  return {
    Queue: vi.fn(() => mockQueue),
    Worker: vi.fn(() => mockWorker)
  }
})

// Mock prisma
const mockTakeFindUnique = vi.fn()
const mockTakeUpdate = vi.fn()
const mockSceneUpdate = vi.fn()

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    take: {
      findUnique: mockTakeFindUnique,
      update: mockTakeUpdate
    },
    scene: {
      update: mockSceneUpdate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Mock SSE
vi.mock('../src/plugins/sse.js', () => ({
  sendTaskUpdate: vi.fn()
}))

// Mock services
vi.mock('../src/services/wan26.js', () => ({
  submitWan26Task: vi.fn(),
  waitForWan26Completion: vi.fn(),
  calculateWan26Cost: vi.fn()
}))

vi.mock('../src/services/seedance.js', () => ({
  submitSeedanceTask: vi.fn(),
  waitForSeedanceCompletion: vi.fn(),
  calculateSeedanceCost: vi.fn()
}))

vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn(),
  generateFileKey: vi.fn()
}))

describe('Video Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should export videoQueue and videoWorker', async () => {
    const { videoQueue, videoWorker } = await import('../src/queues/video.js')
    expect(videoQueue).toBeDefined()
    expect(videoWorker).toBeDefined()
  })

  it('should export videoQueue with correct name', async () => {
    const { videoQueue } = await import('../src/queues/video.js')
    expect(videoQueue).toBeDefined()
  })
})

describe('VideoJobData interface', () => {
  it('should accept valid job data for wan2.6 model', () => {
    const jobData = {
      sceneId: 'scene-123',
      taskId: 'task-456',
      prompt: 'A person walking',
      model: 'wan2.6' as const,
      duration: 5
    }

    expect(jobData.sceneId).toBe('scene-123')
    expect(jobData.taskId).toBe('task-456')
    expect(jobData.prompt).toBe('A person walking')
    expect(jobData.model).toBe('wan2.6')
    expect(jobData.duration).toBe(5)
  })

  it('should accept valid job data for seedance model', () => {
    const jobData = {
      sceneId: 'scene-123',
      taskId: 'task-456',
      prompt: 'A person walking',
      model: 'seedance2.0' as const,
      referenceImage: 'https://example.com/image.jpg',
      duration: 10
    }

    expect(jobData.model).toBe('seedance2.0')
    expect(jobData.referenceImage).toBe('https://example.com/image.jpg')
    expect(jobData.duration).toBe(10)
  })

  it('should accept optional duration', () => {
    const jobData = {
      sceneId: 'scene-123',
      taskId: 'task-456',
      prompt: 'A person walking',
      model: 'wan2.6' as const
    }

    expect(jobData.duration).toBeUndefined()
  })

  it('should accept optional referenceImage', () => {
    const jobData = {
      sceneId: 'scene-123',
      taskId: 'task-456',
      prompt: 'A person walking',
      model: 'wan2.6' as const,
      referenceImage: 'https://example.com/ref.jpg'
    }

    expect(jobData.referenceImage).toBe('https://example.com/ref.jpg')
  })
})
