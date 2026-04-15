import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'

const {
  mockVerifyProjectOwnership,
  mockVerifyLocationOwnership,
  mockLocationFindMany,
  mockLocationFindUnique,
  mockLocationUpdate,
  mockLocationCreate,
  mockSceneUpdateMany,
  mockImageQueueAdd,
  mockUploadFile,
  mockGenerateFileKey
} = vi.hoisted(() => ({
  mockVerifyProjectOwnership: vi.fn().mockResolvedValue(true),
  mockVerifyLocationOwnership: vi.fn().mockResolvedValue(true),
  mockLocationFindMany: vi.fn(),
  mockLocationFindUnique: vi.fn(),
  mockLocationUpdate: vi.fn(),
  mockLocationCreate: vi.fn(),
  mockSceneUpdateMany: vi.fn(),
  mockImageQueueAdd: vi.fn(),
  mockUploadFile: vi.fn(),
  mockGenerateFileKey: vi.fn()
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifyProjectOwnership: (...args: unknown[]) => mockVerifyProjectOwnership(...args),
  verifyLocationOwnership: (...args: unknown[]) => mockVerifyLocationOwnership(...args)
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    location: {
      findMany: mockLocationFindMany,
      findUnique: mockLocationFindUnique,
      findFirst: mockLocationFindUnique,
      update: mockLocationUpdate,
      create: mockLocationCreate
    },
    scene: {
      updateMany: mockSceneUpdateMany
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

vi.mock('../src/services/storage.js', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  generateFileKey: (...args: unknown[]) => mockGenerateFileKey(...args)
}))

vi.mock('../src/queues/image.js', () => ({
  imageQueue: { add: (...args: unknown[]) => mockImageQueueAdd(...args) }
}))

import { locationRoutes } from '../src/routes/locations.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Location routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(multipart)
    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'u1', email: 'a@b.c' }
    })
    await app.register(locationRoutes, { prefix: '/api/locations' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyProjectOwnership.mockResolvedValue(true)
    mockVerifyLocationOwnership.mockResolvedValue(true)
    mockImageQueueAdd.mockResolvedValue({ id: 'jq-1' })
    mockSceneUpdateMany.mockResolvedValue({ count: 0 })
    mockUploadFile.mockResolvedValue('https://minio.example.com/assets/x.png')
    mockGenerateFileKey.mockReturnValue('assets/k.png')
  })

  it('GET / requires projectId', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/locations' })
    expect(res.statusCode).toBe(400)
  })

  it('GET / lists locations', async () => {
    mockLocationFindMany.mockResolvedValue([{ id: 'l1', name: '咖啡厅' }])
    const res = await app.inject({ method: 'GET', url: '/api/locations?projectId=p1' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toHaveLength(1)
  })

  it('POST / returns 400 without projectId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations',
      payload: { name: 'x' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST / returns 201 and creates location', async () => {
    mockLocationCreate.mockResolvedValue({
      id: 'l-new',
      projectId: 'p1',
      name: '新场地',
      timeOfDay: '日',
      characters: [],
      description: null,
      imagePrompt: null,
      imageUrl: null,
      imageCost: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations',
      payload: { projectId: 'p1', name: '新场地' }
    })
    expect(res.statusCode).toBe(201)
    const data = JSON.parse(res.payload)
    expect(data.id).toBe('l-new')
    expect(mockLocationCreate).toHaveBeenCalled()
  })

  it('POST / returns 409 when name duplicates', async () => {
    mockLocationCreate.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations',
      payload: { projectId: 'p1', name: '重复' }
    })
    expect(res.statusCode).toBe(409)
  })

  it('PUT /:id returns 400 when characters is not an array', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/locations/l1',
      payload: { characters: 'not-array' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('PUT /:id updates fields', async () => {
    mockLocationUpdate.mockResolvedValue({ id: 'l1', imagePrompt: 'x' })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/locations/l1',
      payload: { imagePrompt: 'wide shot' }
    })
    expect(res.statusCode).toBe(200)
  })

  it('POST /batch-generate-images enqueues missing only', async () => {
    mockLocationFindMany.mockResolvedValue([
      {
        id: 'l1',
        name: 'A',
        imageUrl: null,
        imagePrompt: 'prompt a',
        projectId: 'p1',
        project: { visualStyle: [] }
      },
      {
        id: 'l2',
        name: 'B',
        imageUrl: 'https://x',
        imagePrompt: 'prompt b',
        projectId: 'p1',
        project: { visualStyle: [] }
      },
      {
        id: 'l3',
        name: 'C',
        imageUrl: null,
        imagePrompt: '',
        projectId: 'p1',
        project: { visualStyle: [] }
      }
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/batch-generate-images',
      payload: { projectId: 'p1' }
    })
    expect(res.statusCode).toBe(202)
    const data = JSON.parse(res.payload) as {
      enqueued: number
      jobIds: string[]
      skipped: { reason: string }[]
    }
    expect(data.enqueued).toBe(1)
    expect(data.enqueuedLocationIds).toEqual(['l1'])
    expect(mockImageQueueAdd).toHaveBeenCalledTimes(1)
    expect(mockImageQueueAdd.mock.calls[0][1]).toMatchObject({
      prompt: 'A establishing shot, empty scene, no people, cinematic lighting. prompt a'
    })
    expect(data.skipped.length).toBe(2)
  })

  it('POST batch uses promptOverrides when UI prompt not yet saved', async () => {
    mockLocationFindMany.mockResolvedValue([
      {
        id: 'l1',
        name: 'A',
        imageUrl: null,
        imagePrompt: null,
        projectId: 'p1',
        project: { visualStyle: [] }
      }
    ])
    mockLocationUpdate.mockResolvedValue({ id: 'l1' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/batch-generate-images',
      payload: { projectId: 'p1', promptOverrides: { l1: '客户端未保存的提示词' } }
    })
    expect(res.statusCode).toBe(202)
    const data = JSON.parse(res.payload) as { enqueued: number }
    expect(data.enqueued).toBe(1)
    expect(mockImageQueueAdd).toHaveBeenCalled()
    expect(mockImageQueueAdd.mock.calls[0][1].prompt).toContain('empty scene, no people')
    expect(mockImageQueueAdd.mock.calls[0][1].prompt).not.toMatch(/^Visual style:/)
    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'l1' },
        data: { imagePrompt: '客户端未保存的提示词' }
      })
    )
  })

  it('POST generate-image enqueues', async () => {
    mockLocationFindUnique.mockResolvedValue({
      id: 'l1',
      name: '街景',
      imagePrompt: 'night city',
      projectId: 'p1',
      project: { visualStyle: ['赛博朋克'] }
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/l1/generate-image',
      payload: {}
    })
    expect(res.statusCode).toBe(202)
    expect(mockImageQueueAdd).toHaveBeenCalled()
    expect(mockImageQueueAdd.mock.calls[0][1]).toMatchObject({
      prompt:
        '街景 establishing shot, empty scene, no people, cinematic lighting. night city'
    })
    expect(mockImageQueueAdd.mock.calls[0][1].prompt).not.toMatch(/^Visual style:/)
  })

  it('GET 403 without project ownership', async () => {
    mockVerifyProjectOwnership.mockResolvedValueOnce(false)
    const res = await app.inject({ method: 'GET', url: '/api/locations?projectId=p1' })
    expectPermissionDeniedPayload(res)
  })

  it('DELETE /:id clears scene refs and soft-deletes', async () => {
    mockLocationFindUnique.mockResolvedValue({ id: 'l1', projectId: 'p1', name: '咖啡厅' })
    mockLocationUpdate.mockResolvedValue({ id: 'l1', deletedAt: new Date() })
    const res = await app.inject({ method: 'DELETE', url: '/api/locations/l1' })
    expect(res.statusCode).toBe(204)
    expect(mockSceneUpdateMany).toHaveBeenCalledWith({
      where: { locationId: 'l1' },
      data: { locationId: null }
    })
    expect(mockLocationUpdate).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { deletedAt: expect.any(Date) }
    })
  })

  it('POST /:id/image returns 400 when not multipart', async () => {
    mockLocationFindUnique.mockResolvedValue({ id: 'l1', name: 'a', projectId: 'p1' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/l1/image',
      payload: {}
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /:id/image uploads and updates location', async () => {
    mockLocationFindUnique.mockResolvedValue({ id: 'l1', name: 'a', projectId: 'p1' })
    mockLocationUpdate.mockResolvedValue({
      id: 'l1',
      imageUrl: 'https://minio.example.com/assets/x.png',
      imageCost: null
    })
    const boundary = 'boundaryloc123'
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
    const pre = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
      'utf8'
    )
    const post = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    const payload = Buffer.concat([pre, png, post])
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/l1/image',
      payload,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }
    })
    expect(res.statusCode).toBe(200)
    expect(mockUploadFile).toHaveBeenCalled()
    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'l1' },
        data: { imageUrl: 'https://minio.example.com/assets/x.png', imageCost: null }
      })
    )
  })
})
