import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn()
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    modelApiCall: {
      findMany: mockFindMany
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { modelApiCallRoutes } from '../src/routes/model-api-calls.js'

describe('Model API calls routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'user-1', email: 'a@b.c' }
    })
    await app.register(modelApiCallRoutes, { prefix: '/api/model-api-calls' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
  })

  it('GET / returns items for current user', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'c1',
        model: 'deepseek-chat',
        provider: 'deepseek',
        prompt: 'x',
        status: 'completed',
        requestParams: JSON.stringify({ op: 'script_visual_enrichment', projectId: 'proj1' })
      }
    ])
    const res = await app.inject({ method: 'GET', url: '/api/model-api-calls' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload) as {
      items: { meta: { op?: string; projectId?: string } }[]
      limit: number
    }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].meta).toEqual({ op: 'script_visual_enrichment', projectId: 'proj1' })
    expect(mockFindMany).toHaveBeenCalled()
  })

  it('GET / with op passes AND filter on requestParams', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/model-api-calls?op=script_visual_enrichment'
    })
    expect(res.statusCode).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { userId: 'user-1' },
            { requestParams: { contains: 'script_visual_enrichment' } }
          ])
        }
      })
    )
  })

  it('GET / with status=failed adds status filter', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/model-api-calls?status=failed'
    })
    expect(res.statusCode).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([{ userId: 'user-1' }, { status: 'failed' }])
        }
      })
    )
  })
})
