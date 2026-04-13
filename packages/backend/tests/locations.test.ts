import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockVerifyProjectOwnership,
  mockVerifyLocationOwnership,
  mockLocationFindMany,
  mockLocationFindUnique,
  mockLocationUpdate,
  mockImageQueueAdd
} = vi.hoisted(() => ({
  mockVerifyProjectOwnership: vi.fn().mockResolvedValue(true),
  mockVerifyLocationOwnership: vi.fn().mockResolvedValue(true),
  mockLocationFindMany: vi.fn(),
  mockLocationFindUnique: vi.fn(),
  mockLocationUpdate: vi.fn(),
  mockImageQueueAdd: vi.fn()
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifyProjectOwnership: (...args: unknown[]) => mockVerifyProjectOwnership(...args),
  verifyLocationOwnership: (...args: unknown[]) => mockVerifyLocationOwnership(...args)
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    location: {
      findMany: mockLocationFindMany,
      findUnique: mockLocationFindUnique,
      update: mockLocationUpdate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
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

  it('POST generate-image enqueues', async () => {
    mockLocationFindUnique.mockResolvedValue({
      id: 'l1',
      name: '街景',
      imagePrompt: 'night city',
      projectId: 'p1',
      project: { visualStyle: [] }
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/locations/l1/generate-image',
      payload: {}
    })
    expect(res.statusCode).toBe(202)
    expect(mockImageQueueAdd).toHaveBeenCalled()
  })

  it('GET 403 without project ownership', async () => {
    mockVerifyProjectOwnership.mockResolvedValueOnce(false)
    const res = await app.inject({ method: 'GET', url: '/api/locations?projectId=p1' })
    expectPermissionDeniedPayload(res)
  })
})
