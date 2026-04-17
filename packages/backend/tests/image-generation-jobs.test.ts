import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const mockGetJobs = vi.fn()

vi.mock('../src/queues/image.js', () => ({
  imageQueue: {
    getJobs: (...args: unknown[]) => mockGetJobs(...args)
  }
}))

import { imageGenerationJobRoutes } from '../src/routes/image-generation-jobs.js'

function mockJob(id: string, data: Record<string, unknown>, getState: string) {
  return {
    id,
    data,
    timestamp: Date.now(),
    finishedOn: undefined as number | undefined,
    processedOn: undefined as number | undefined,
    failedReason: null,
    returnvalue: null,
    getState: vi.fn().mockResolvedValue(getState)
  }
}

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
    const jobA = mockJob(
      '1',
      {
        userId: 'user-1',
        projectId: 'p1',
        kind: 'location_establishing',
        locationId: 'loc-1',
        prompt: 'x'
      },
      'completed'
    )
    const jobB = mockJob(
      '2',
      {
        userId: 'other',
        projectId: 'p2',
        kind: 'character_base_regenerate',
        characterImageId: 'img-1',
        prompt: 'y'
      },
      'completed'
    )
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
      locationId: 'loc-1',
      binding: { kind: 'location', locationId: 'loc-1' }
    })
  })

  it('binding for character_base_regenerate', async () => {
    const job = mockJob(
      '10',
      {
        userId: 'user-1',
        projectId: 'p1',
        kind: 'character_base_regenerate',
        characterImageId: 'ci-1',
        prompt: 'p'
      },
      'active'
    )
    mockGetJobs.mockResolvedValue([job])
    const res = await app.inject({ method: 'GET', url: '/api/image-generation/jobs' })
    const data = JSON.parse(res.payload) as Record<string, unknown>[]
    expect(data[0]).toMatchObject({
      kind: 'character_base_regenerate',
      characterImageId: 'ci-1',
      binding: { kind: 'character_image', characterImageId: 'ci-1' }
    })
  })

  it('binding for character_derived_regenerate', async () => {
    const job = mockJob(
      '11',
      {
        userId: 'user-1',
        projectId: 'p1',
        kind: 'character_derived_regenerate',
        characterImageId: 'ci-2',
        referenceImageUrl: 'http://x',
        editPrompt: 'e'
      },
      'waiting'
    )
    mockGetJobs.mockResolvedValue([job])
    const res = await app.inject({ method: 'GET', url: '/api/image-generation/jobs' })
    const data = JSON.parse(res.payload) as Record<string, unknown>[]
    expect(data[0]).toMatchObject({
      binding: { kind: 'character_image', characterImageId: 'ci-2' }
    })
  })

  it('binding for character_base_create includes name', async () => {
    const job = mockJob(
      '12',
      {
        userId: 'user-1',
        projectId: 'p1',
        kind: 'character_base_create',
        characterId: 'ch-1',
        name: '定妆A',
        prompt: 'p'
      },
      'delayed'
    )
    mockGetJobs.mockResolvedValue([job])
    const res = await app.inject({ method: 'GET', url: '/api/image-generation/jobs' })
    const data = JSON.parse(res.payload) as Record<string, unknown>[]
    expect(data[0]).toMatchObject({
      kind: 'character_base_create',
      characterId: 'ch-1',
      binding: {
        kind: 'character_new_image',
        characterId: 'ch-1',
        createKind: 'character_base_create',
        name: '定妆A'
      }
    })
  })

  it('binding for character_derived_create includes parentImageId', async () => {
    const job = mockJob(
      '13',
      {
        userId: 'user-1',
        projectId: 'p1',
        kind: 'character_derived_create',
        characterId: 'ch-2',
        parentImageId: 'parent-1',
        name: '子形象',
        description: 'd',
        referenceImageUrl: 'http://ref',
        editPrompt: 'e'
      },
      'active'
    )
    mockGetJobs.mockResolvedValue([job])
    const res = await app.inject({ method: 'GET', url: '/api/image-generation/jobs' })
    const data = JSON.parse(res.payload) as Record<string, unknown>[]
    expect(data[0]).toMatchObject({
      binding: {
        kind: 'character_new_image',
        characterId: 'ch-2',
        createKind: 'character_derived_create',
        name: '子形象',
        parentImageId: 'parent-1'
      }
    })
  })
})
