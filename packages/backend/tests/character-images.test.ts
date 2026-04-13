import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockVerifyCharacterImageOwnership,
  mockCharacterImageFindUnique,
  mockCharacterImageUpdate,
  mockImageQueueAdd
} = vi.hoisted(() => ({
  mockVerifyCharacterImageOwnership: vi.fn().mockResolvedValue(true),
  mockCharacterImageFindUnique: vi.fn(),
  mockCharacterImageUpdate: vi.fn(),
  mockImageQueueAdd: vi.fn()
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifyCharacterImageOwnership: (...args: unknown[]) => mockVerifyCharacterImageOwnership(...args)
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    characterImage: {
      findUnique: mockCharacterImageFindUnique,
      update: mockCharacterImageUpdate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

vi.mock('../src/queues/image.js', () => ({
  imageQueue: { add: (...args: unknown[]) => mockImageQueueAdd(...args) }
}))

import { characterImageRoutes } from '../src/routes/character-images.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Character image routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'u1', email: 'a@b.c' }
    })
    await app.register(characterImageRoutes, { prefix: '/api/character-images' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCharacterImageOwnership.mockResolvedValue(true)
    mockImageQueueAdd.mockResolvedValue({ id: 'job-1' })
  })

  it('POST generate base queues character_base_regenerate', async () => {
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-1',
      prompt: 'English prompt',
      parentId: null,
      character: {
        project: { id: 'p1', visualStyle: ['cinematic'] }
      },
      parent: null
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/img-1/generate',
      payload: {}
    })

    expect(res.statusCode).toBe(202)
    const data = JSON.parse(res.payload)
    expect(data.jobId).toBe('job-1')
    expect(mockImageQueueAdd).toHaveBeenCalled()
    const arg = mockImageQueueAdd.mock.calls[0][1]
    expect(arg.kind).toBe('character_base_regenerate')
  })

  it('POST generate returns 400 without prompt', async () => {
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-1',
      prompt: null,
      parentId: null,
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: null
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/img-1/generate',
      payload: {}
    })

    expect(res.statusCode).toBe(400)
  })

  it('POST generate derived requires parent avatar', async () => {
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-2',
      prompt: 'outfit',
      parentId: 'img-1',
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: { avatarUrl: null }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/img-2/generate',
      payload: {}
    })

    expect(res.statusCode).toBe(400)
  })

  it('POST generate derived enqueues when parent has avatarUrl', async () => {
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-2',
      prompt: 'edit prompt',
      parentId: 'img-1',
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: { avatarUrl: 'https://cdn.example.com/parent.png' }
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/img-2/generate',
      payload: {}
    })

    expect(res.statusCode).toBe(202)
    const arg = mockImageQueueAdd.mock.calls[0][1]
    expect(arg.kind).toBe('character_derived_regenerate')
    expect(arg.referenceImageUrl).toBe('https://cdn.example.com/parent.png')
  })

  it('POST generate with body.prompt updates row before queue', async () => {
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-1',
      prompt: 'old',
      parentId: null,
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: null
    })
    mockCharacterImageUpdate.mockResolvedValue({ id: 'img-1', prompt: 'new from body' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/img-1/generate',
      payload: { prompt: 'new from body' }
    })

    expect(res.statusCode).toBe(202)
    expect(mockCharacterImageUpdate).toHaveBeenCalledWith({
      where: { id: 'img-1' },
      data: { prompt: 'new from body' }
    })
  })

  it('returns 403 when not owner', async () => {
    mockVerifyCharacterImageOwnership.mockResolvedValueOnce(false)
    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/img-1/generate',
      payload: {}
    })
    expectPermissionDeniedPayload(res)
  })
})
