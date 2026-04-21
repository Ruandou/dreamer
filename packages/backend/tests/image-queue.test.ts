import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    close: vi.fn()
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn()
  }))
}))

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    quit: vi.fn()
  }))
}))

vi.mock('../src/services/ai/image-generation.js', () => ({
  generateTextToImageAndPersist: vi.fn(),
  generateImageEditAndPersist: vi.fn(),
  arkImageSizeFromProjectAspectRatio: vi.fn().mockReturnValue('1024x1024'),
  imageJobPrompt: vi.fn().mockReturnValue('prompt'),
  imageJobModel: vi.fn().mockReturnValue('model')
}))

vi.mock('../src/services/ai/api-logger.js', () => ({
  recordModelApiCall: vi.fn()
}))

vi.mock('../src/plugins/sse.js', () => ({
  sendProjectUpdate: vi.fn()
}))

vi.mock('../src/services/image-queue-service.js', () => ({
  imageQueueService: {
    getProjectAspectRatio: vi.fn().mockResolvedValue({ aspectRatio: '9:16' }),
    maxOrderForCharacterSlot: vi.fn().mockResolvedValue({ _max: { order: null } }),
    createCharacterImageBase: vi.fn().mockResolvedValue({ id: 'img-1' }),
    updateCharacterImageAvatar: vi.fn().mockResolvedValue({ id: 'img-1', characterId: 'char-1' }),
    createCharacterImageDerived: vi.fn().mockResolvedValue({ id: 'img-2' }),
    updateLocationEstablishingImage: vi.fn().mockResolvedValue({ count: 1 })
  }
}))

describe('image queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('module can be imported', async () => {
    const mod = await import('../src/queues/image.js')
    expect(mod).toBeDefined()
    expect(mod.imageQueue).toBeDefined()
    expect(mod.closeImageWorker).toBeDefined()
  })
})
