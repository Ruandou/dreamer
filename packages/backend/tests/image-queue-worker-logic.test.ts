import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

// Mock ioredis
vi.mock('ioredis', () => {
  const mRedis = {
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnThis()
  }
  return { default: vi.fn(() => mRedis) }
})

// Mock services
const mockGetProjectAspectRatio = vi.fn()
const mockMaxOrderForCharacterSlot = vi.fn()
const mockCreateCharacterImageBase = vi.fn()
const mockUpdateCharacterImageAvatar = vi.fn()
const mockCreateCharacterImageDerived = vi.fn()
const mockUpdateLocationEstablishingImage = vi.fn()

vi.mock('../src/services/image-queue-service.js', () => ({
  imageQueueService: {
    getProjectAspectRatio: mockGetProjectAspectRatio,
    maxOrderForCharacterSlot: mockMaxOrderForCharacterSlot,
    createCharacterImageBase: mockCreateCharacterImageBase,
    updateCharacterImageAvatar: mockUpdateCharacterImageAvatar,
    createCharacterImageDerived: mockCreateCharacterImageDerived,
    updateLocationEstablishingImage: mockUpdateLocationEstablishingImage
  }
}))

// Mock AI services
const mockGenerateTextToImageAndPersist = vi.fn()
const mockGenerateImageEditAndPersist = vi.fn()
const mockArkImageSizeFromProjectAspectRatio = vi.fn()
const mockImageJobPrompt = vi.fn()
const mockImageJobModel = vi.fn()

const mockGetDefaultImageProvider = vi.fn().mockReturnValue({ name: 'kling' })

vi.mock('../src/services/ai/image-generation.js', () => ({
  generateTextToImageAndPersist: mockGenerateTextToImageAndPersist,
  generateImageEditAndPersist: mockGenerateImageEditAndPersist,
  getDefaultImageProvider: mockGetDefaultImageProvider,
  arkImageSizeFromProjectAspectRatio: mockArkImageSizeFromProjectAspectRatio,
  imageJobPrompt: mockImageJobPrompt,
  imageJobModel: mockImageJobModel
}))

// Mock API logger
const mockRecordModelApiCall = vi.fn()

vi.mock('../src/services/ai/api-logger.js', () => ({
  recordModelApiCall: mockRecordModelApiCall
}))

// Mock SSE
const mockSendProjectUpdate = vi.fn()

vi.mock('../src/plugins/sse.js', () => ({
  sendProjectUpdate: mockSendProjectUpdate
}))

// Mock BullMQ Worker
let capturedImageProcessor: Function

vi.mock('bullmq', () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  }

  const MockWorker = vi.fn((name, processor, options) => {
    capturedImageProcessor = processor
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

describe('Image Queue Worker', () => {
  beforeAll(async () => {
    await import('../src/queues/image.js')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDefaultImageProvider.mockReturnValue({ name: 'kling' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process character_base_create job successfully', async () => {
    await import('../src/queues/image.js')

    expect(capturedImageProcessor).toBeDefined()

    const mockJob = {
      id: 'img-job-1',
      data: {
        kind: 'character_base_create',
        userId: 'user-1',
        projectId: 'project-1',
        characterId: 'char-1',
        name: '定妆照A',
        prompt: 'A professional portrait'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '9:16' })
    mockArkImageSizeFromProjectAspectRatio.mockReturnValue('1080x1920')
    mockGenerateTextToImageAndPersist.mockResolvedValue({
      url: 'https://example.com/image.jpg',
      imageCost: 0.04
    })
    mockMaxOrderForCharacterSlot.mockResolvedValue({ _max: { order: 2 } })
    mockCreateCharacterImageBase.mockResolvedValue({
      id: 'img-1',
      avatarUrl: 'https://example.com/image.jpg',
      imageCost: 0.04
    })
    mockImageJobPrompt.mockReturnValue('A professional portrait')
    mockImageJobModel.mockReturnValue('doubao-seedream-4.0')

    const result = await capturedImageProcessor(mockJob)

    expect(mockGetProjectAspectRatio).toHaveBeenCalledWith('project-1')
    expect(mockGenerateTextToImageAndPersist).toHaveBeenCalledWith('A professional portrait', {
      size: '1080x1920'
    })
    expect(mockCreateCharacterImageBase).toHaveBeenCalledWith({
      characterId: 'char-1',
      name: '定妆照A',
      parentId: null,
      type: 'base',
      avatarUrl: 'https://example.com/image.jpg',
      imageCost: 0.04,
      order: 3
    })
    expect(mockSendProjectUpdate).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'image-generation',
      expect.objectContaining({
        status: 'completed',
        kind: 'character_base_create'
      })
    )
    expect(mockRecordModelApiCall).toHaveBeenCalled()
    expect(result).toEqual({
      characterImageId: 'img-1',
      imageCost: 0.04
    })
  })

  it('should process character_base_regenerate job', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-2',
      data: {
        kind: 'character_base_regenerate',
        userId: 'user-1',
        projectId: 'project-1',
        characterImageId: 'img-1',
        prompt: 'Updated prompt'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '16:9' })
    mockArkImageSizeFromProjectAspectRatio.mockReturnValue('1920x1080')
    mockGenerateTextToImageAndPersist.mockResolvedValue({
      url: 'https://example.com/new-image.jpg',
      imageCost: 0.05
    })
    mockUpdateCharacterImageAvatar.mockResolvedValue({
      id: 'img-1',
      avatarUrl: 'https://example.com/new-image.jpg'
    })

    await capturedImageProcessor(mockJob)

    expect(mockUpdateCharacterImageAvatar).toHaveBeenCalledWith('img-1', {
      avatarUrl: 'https://example.com/new-image.jpg',
      prompt: 'Updated prompt',
      imageCost: 0.05
    })
  })

  it('should process character_derived_create job', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-3',
      data: {
        kind: 'character_derived_create',
        userId: 'user-1',
        projectId: 'project-1',
        characterId: 'char-1',
        parentImageId: 'parent-img-1',
        name: '新服装',
        description: '西装版本',
        referenceImageUrl: 'https://example.com/ref.jpg',
        editPrompt: 'Change to business suit'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '9:16' })
    mockGenerateImageEditAndPersist.mockResolvedValue({
      url: 'https://example.com/edited-image.jpg',
      imageCost: 0.03
    })
    mockMaxOrderForCharacterSlot.mockResolvedValue({ _max: { order: 5 } })
    mockCreateCharacterImageDerived.mockResolvedValue({
      id: 'img-2',
      avatarUrl: 'https://example.com/edited-image.jpg'
    })

    await capturedImageProcessor(mockJob)

    expect(mockGenerateImageEditAndPersist).toHaveBeenCalledWith(
      'https://example.com/ref.jpg',
      'Change to business suit',
      expect.any(Object)
    )
    expect(mockCreateCharacterImageDerived).toHaveBeenCalled()
  })

  it('should process character_derived_regenerate job', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-4',
      data: {
        kind: 'character_derived_regenerate',
        userId: 'user-1',
        projectId: 'project-1',
        characterImageId: 'img-3',
        referenceImageUrl: 'https://example.com/ref.jpg',
        editPrompt: 'Updated edit prompt'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '9:16' })
    mockGenerateImageEditAndPersist.mockResolvedValue({
      url: 'https://example.com/new-edited.jpg',
      imageCost: 0.035
    })
    mockUpdateCharacterImageAvatar.mockResolvedValue({
      id: 'img-3'
    })

    await capturedImageProcessor(mockJob)

    expect(mockUpdateCharacterImageAvatar).toHaveBeenCalledWith(
      'img-3',
      expect.objectContaining({
        avatarUrl: 'https://example.com/new-edited.jpg',
        imageCost: 0.035
      })
    )
  })

  it('should process location_establishing job', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-5',
      data: {
        kind: 'location_establishing',
        userId: 'user-1',
        projectId: 'project-1',
        locationId: 'loc-1',
        prompt: 'Modern office interior'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '16:9' })
    mockArkImageSizeFromProjectAspectRatio.mockReturnValue('1920x1080')
    mockGenerateTextToImageAndPersist.mockResolvedValue({
      url: 'https://example.com/location.jpg',
      imageCost: 0.04
    })
    mockUpdateLocationEstablishingImage.mockResolvedValue({
      count: 1
    })

    await capturedImageProcessor(mockJob)

    expect(mockGenerateTextToImageAndPersist).toHaveBeenCalledWith('Modern office interior', {
      size: '1920x1080'
    })
    expect(mockUpdateLocationEstablishingImage).toHaveBeenCalledWith('loc-1', {
      imageUrl: 'https://example.com/location.jpg',
      imageCost: 0.04
    })
  })

  it('should handle image generation failure', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-6',
      data: {
        kind: 'character_base_create',
        userId: 'user-1',
        projectId: 'project-1',
        characterId: 'char-1',
        name: 'Test',
        prompt: 'Test prompt'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '9:16' })
    mockGenerateTextToImageAndPersist.mockRejectedValue(new Error('Content safety violation'))

    await expect(capturedImageProcessor(mockJob)).rejects.toThrow('Content safety violation')

    expect(mockSendProjectUpdate).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'image-generation',
      expect.objectContaining({
        status: 'failed'
      })
    )
  })

  it('should handle null imageCost gracefully', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-7',
      data: {
        kind: 'character_base_create',
        userId: 'user-1',
        projectId: 'project-1',
        characterId: 'char-1',
        name: 'Test',
        prompt: 'Test prompt'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '9:16' })
    mockGenerateTextToImageAndPersist.mockResolvedValue({
      url: 'https://example.com/image.jpg',
      imageCost: null
    })
    mockMaxOrderForCharacterSlot.mockResolvedValue({ _max: { order: 0 } })
    mockCreateCharacterImageBase.mockResolvedValue({
      id: 'img-10'
    })

    const result = await capturedImageProcessor(mockJob)

    expect(result).toEqual({
      characterImageId: 'img-10',
      imageCost: null
    })
  })

  it('should handle missing project aspect ratio', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-8',
      data: {
        kind: 'character_base_create',
        userId: 'user-1',
        projectId: 'project-1',
        characterId: 'char-1',
        name: 'Test',
        prompt: 'Test prompt'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue(null)
    mockArkImageSizeFromProjectAspectRatio.mockReturnValue('1024x1024') // Default
    mockGenerateTextToImageAndPersist.mockResolvedValue({
      url: 'https://example.com/image.jpg',
      imageCost: 0.04
    })
    mockMaxOrderForCharacterSlot.mockResolvedValue({ _max: { order: 0 } })
    mockCreateCharacterImageBase.mockResolvedValue({
      id: 'img-11'
    })

    await capturedImageProcessor(mockJob)

    expect(mockArkImageSizeFromProjectAspectRatio).toHaveBeenCalledWith(undefined)
  })

  it('should record API call with correct parameters', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'img-job-9',
      data: {
        kind: 'location_establishing',
        userId: 'user-1',
        projectId: 'project-1',
        locationId: 'loc-1',
        prompt: 'Beach scene'
      }
    }

    mockGetProjectAspectRatio.mockResolvedValue({ aspectRatio: '16:9' })
    mockGenerateTextToImageAndPersist.mockResolvedValue({
      url: 'https://example.com/beach.jpg',
      imageCost: 0.045
    })
    mockUpdateLocationEstablishingImage.mockResolvedValue({ count: 1 })
    mockImageJobModel.mockReturnValue('doubao-seedream-4.0')
    mockImageJobPrompt.mockReturnValue('Beach scene')

    await capturedImageProcessor(mockJob)

    expect(mockRecordModelApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        model: 'doubao-seedream-4.0',
        provider: 'kling',
        prompt: 'Beach scene',
        status: 'completed',
        cost: 0.045
      })
    )
  })
})
