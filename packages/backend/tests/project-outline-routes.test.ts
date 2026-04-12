import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockProjectFindFirst,
  mockProjectFindUnique,
  mockProjectUpdate,
  mockProjectFindMany,
  mockProjectCreate,
  mockProjectDelete,
  mockEpisodeFindUnique,
  mockPipelineJobCreate,
  mockRunParseScriptJob,
  mockRunScriptBatchJob,
  mockRunGenerateFirstEpisode
} = vi.hoisted(() => ({
  mockProjectFindFirst: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockProjectUpdate: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockProjectCreate: vi.fn(),
  mockProjectDelete: vi.fn(),
  mockEpisodeFindUnique: vi.fn(),
  mockPipelineJobCreate: vi.fn(),
  mockRunParseScriptJob: vi.fn(),
  mockRunScriptBatchJob: vi.fn(),
  mockRunGenerateFirstEpisode: vi.fn()
}))

vi.mock('../src/services/project-script-jobs.js', () => ({
  runParseScriptJob: (...args: unknown[]) => mockRunParseScriptJob(...args) as Promise<void>,
  runScriptBatchJob: (...args: unknown[]) => mockRunScriptBatchJob(...args) as Promise<void>,
  runGenerateFirstEpisode: (...args: unknown[]) => mockRunGenerateFirstEpisode(...args) as Promise<void>,
  DEFAULT_TARGET_EPISODES: 60
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    project: {
      findMany: mockProjectFindMany,
      findFirst: mockProjectFindFirst,
      findUnique: mockProjectFindUnique,
      create: mockProjectCreate,
      update: mockProjectUpdate,
      delete: mockProjectDelete
    },
    episode: {
      findUnique: mockEpisodeFindUnique
    },
    pipelineJob: {
      create: mockPipelineJobCreate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { projectRoutes } from '../src/routes/projects.js'

const rawEp1 = {
  title: '第一集',
  summary: '一',
  scenes: [
    {
      sceneNum: 1,
      location: '屋内',
      timeOfDay: '夜',
      characters: ['甲'],
      description: '开场',
      dialogues: [],
      actions: []
    }
  ]
}

describe('Project outline & parse routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('authenticate', vi.fn().mockImplementation(async (request: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    }))
    await app.register(projectRoutes, { prefix: '/api/projects' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRunParseScriptJob.mockReturnValue(Promise.resolve())
    mockRunScriptBatchJob.mockReturnValue(Promise.resolve())
    mockRunGenerateFirstEpisode.mockReturnValue(Promise.resolve())
  })

  describe('POST /api/projects/:id/parse', () => {
    it('returns 400 when visualStyle is empty', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'p1',
        userId: 'test-user-id',
        visualStyle: [],
        episodes: [{ episodeNum: 1, rawScript: rawEp1 }]
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/parse',
        payload: {}
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.payload)
      expect(body.error).toMatch(/视觉风格/)
    })

    it('returns 400 when episode 1 rawScript has no scenes array', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'p1',
        userId: 'test-user-id',
        visualStyle: ['cinematic'],
        episodes: [{ episodeNum: 1, rawScript: { title: 'x', summary: 'y' } }]
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/parse',
        payload: {}
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when episode 1 has empty scenes array', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'p1',
        userId: 'test-user-id',
        visualStyle: ['cinematic'],
        episodes: [{ episodeNum: 1, rawScript: { title: 'x', summary: 'y', scenes: [] } }]
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/parse',
        payload: {}
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 200 and starts parse job', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'p1',
        userId: 'test-user-id',
        visualStyle: ['cinematic'],
        episodes: [{ episodeNum: 1, rawScript: rawEp1 }]
      })
      mockPipelineJobCreate.mockResolvedValue({ id: 'job-parse-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/parse',
        payload: { targetEpisodes: 5 }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.jobId).toBe('job-parse-1')
      expect(mockPipelineJobCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'p1',
            jobType: 'parse-script',
            currentStep: 'parse-script'
          })
        })
      )
      expect(mockRunParseScriptJob).toHaveBeenCalledWith('job-parse-1', 'p1', 5)
    })
  })

  describe('POST /api/projects/:id/episodes/generate-remaining', () => {
    it('returns 400 when episode 1 missing', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockEpisodeFindUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/episodes/generate-remaining',
        payload: { targetEpisodes: 10 }
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.payload)
      expect(body.error).toMatch(/第一集/)
    })

    it('returns 200 and creates script-batch job', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockEpisodeFindUnique.mockResolvedValue({ id: 'e1', rawScript: rawEp1 })
      mockPipelineJobCreate.mockResolvedValue({ id: 'job-batch-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/episodes/generate-remaining',
        payload: { targetEpisodes: 8 }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.jobId).toBe('job-batch-1')
      expect(mockRunScriptBatchJob).toHaveBeenCalledWith('job-batch-1', 'p1', 8)
    })

    it('returns 400 when targetEpisodes out of range', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/episodes/generate-remaining',
        payload: { targetEpisodes: 1 }
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /api/projects/:id/episodes/generate-first', () => {
    it('returns 404 when project missing', async () => {
      mockProjectFindFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/missing/episodes/generate-first',
        payload: {}
      })
      expect(res.statusCode).toBe(404)
    })

    it('returns episode and synopsis after generate', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id', name: 'N' })
      mockRunGenerateFirstEpisode.mockResolvedValue(undefined)
      mockProjectFindUnique.mockResolvedValue({
        id: 'p1',
        synopsis: '全剧梗概',
        episodes: [{ id: 'ep1', episodeNum: 1, rawScript: rawEp1 }]
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects/p1/episodes/generate-first',
        payload: { description: '  新创意  ' }
      })
      expect(res.statusCode).toBe(200)
      expect(mockRunGenerateFirstEpisode).toHaveBeenCalledWith('p1')
      expect(mockProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { description: '新创意' }
      })
      const body = JSON.parse(res.payload)
      expect(body.synopsis).toBe('全剧梗概')
      expect(body.episode.episodeNum).toBe(1)
    })
  })
})
