import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockVerifyCharacterImageOwnership,
  mockVerifyProjectOwnership,
  mockVerifyCharacterOwnership,
  mockCharacterImageFindUnique,
  mockCharacterImageFindMany,
  mockCharacterImageUpdate,
  mockImageQueueAdd
} = vi.hoisted(() => ({
  mockVerifyCharacterImageOwnership: vi.fn().mockResolvedValue(true),
  mockVerifyProjectOwnership: vi.fn().mockResolvedValue(true),
  mockVerifyCharacterOwnership: vi.fn().mockResolvedValue(true),
  mockCharacterImageFindUnique: vi.fn(),
  mockCharacterImageFindMany: vi.fn(),
  mockCharacterImageUpdate: vi.fn(),
  mockImageQueueAdd: vi.fn()
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifyCharacterImageOwnership: (...args: unknown[]) => mockVerifyCharacterImageOwnership(...args),
  verifyProjectOwnership: (...args: unknown[]) => mockVerifyProjectOwnership(...args),
  verifyCharacterOwnership: (...args: unknown[]) => mockVerifyCharacterOwnership(...args)
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    characterImage: {
      findUnique: mockCharacterImageFindUnique,
      findMany: mockCharacterImageFindMany,
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
    mockVerifyProjectOwnership.mockResolvedValue(true)
    mockVerifyCharacterOwnership.mockResolvedValue(true)
    mockCharacterImageFindMany.mockResolvedValue([])
    mockImageQueueAdd.mockResolvedValue({ id: 'job-1' })
  })

  it('POST generate base queues character_base_regenerate', async () => {
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-1',
      prompt: '中文提示词',
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

  it('POST batch-generate-missing-avatars returns 400 without projectId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/batch-generate-missing-avatars',
      payload: {}
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST batch-generate-missing-avatars returns 403 when not project owner', async () => {
    mockVerifyProjectOwnership.mockResolvedValueOnce(false)
    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/batch-generate-missing-avatars',
      payload: { projectId: 'p1' }
    })
    expectPermissionDeniedPayload(res)
  })

  it('POST batch-generate-missing-avatars returns 202 and enqueues', async () => {
    mockCharacterImageFindMany.mockResolvedValue([
      {
        id: 'img-1',
        name: '主',
        prompt: '中文',
        avatarUrl: null,
        parentId: null,
        character: { name: 'A', project: { id: 'p1', visualStyle: [] } },
        parent: null
      }
    ])
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-1',
      prompt: '中文',
      parentId: null,
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: null
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/batch-generate-missing-avatars',
      payload: { projectId: 'p1' }
    })

    expect(res.statusCode).toBe(202)
    const data = JSON.parse(res.payload)
    expect(data.enqueued).toBe(1)
    expect(data.enqueuedCharacterImageIds).toEqual(['img-1'])
    expect(mockImageQueueAdd).toHaveBeenCalled()
  })

  it('POST batch-generate-missing-avatars with characterId returns 403 when not character owner', async () => {
    mockVerifyCharacterOwnership.mockResolvedValueOnce(false)
    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/batch-generate-missing-avatars',
      payload: { projectId: 'p1', characterId: 'c1' }
    })
    expectPermissionDeniedPayload(res)
  })

  it('POST batch-generate-missing-avatars with characterId returns 202', async () => {
    mockCharacterImageFindMany.mockResolvedValue([
      {
        id: 'img-1',
        name: '主',
        prompt: '中文',
        avatarUrl: null,
        parentId: null,
        character: { name: 'A', project: { id: 'p1', visualStyle: [] } },
        parent: null
      }
    ])
    mockCharacterImageFindUnique.mockResolvedValue({
      id: 'img-1',
      prompt: '中文',
      parentId: null,
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: null
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/character-images/batch-generate-missing-avatars',
      payload: { projectId: 'p1', characterId: 'c1' }
    })

    expect(res.statusCode).toBe(202)
    const data = JSON.parse(res.payload)
    expect(data.enqueued).toBe(1)
    expect(mockVerifyCharacterOwnership).toHaveBeenCalledWith('u1', 'c1')
  })
})
