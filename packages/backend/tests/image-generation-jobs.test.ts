import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const mockGetJobs = vi.fn()

vi.mock('../src/queues/image.js', () => ({
  imageQueue: {
    getJobs: (...args: unknown[]) => mockGetJobs(...args)
  }
}))

import { imageGenerationJobRoutes } from '../src/routes/image-generation-jobs.js'

describe('GET /api/image-generation/jobs', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'user-1', email: 'a@b.c' }
    })
    await app.register(imageGenerationJobRoutes, { prefix: '/api/image-generation' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only current user jobs with kind and ids', async () => {
    const jobA = {
      id: '1',
      data: {
        userId: 'user-1',
        projectId: 'p1',
        kind: 'location_establishing',
        locationId: 'loc-1',
        prompt: 'x'
      },
      timestamp: Date.now(),
      finishedOn: Date.now(),
      processedOn: Date.now(),
      failedReason: null,
      returnvalue: { locationId: 'loc-1', imageCost: 0.01 },
      getState: vi.fn().mockResolvedValue('completed')
    }
    const jobB = {
      id: '2',
      data: {
        userId: 'other',
        projectId: 'p2',
        kind: 'character_base_regenerate',
        characterImageId: 'img-1',
        prompt: 'y'
      },
      timestamp: Date.now(),
      getState: vi.fn().mockResolvedValue('completed')
    }
    mockGetJobs.mockResolvedValue([jobA, jobB])

    const res = await app.inject({ method: 'GET', url: '/api/image-generation/jobs' })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.payload) as unknown[]
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      type: 'image',
      kind: 'location_establishing',
      projectId: 'p1',
      locationId: 'loc-1'
    })
  })
})
