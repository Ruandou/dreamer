import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockEpisodeFindMany,
  mockEpisodeFindUnique,
  mockEpisodeCreate,
  mockEpisodeUpdate,
  mockEpisodeDelete,
  mockProjectFindFirst,
  mockProjectFindUnique,
  mockSceneDeleteMany,
  mockSceneCreate,
  mockSceneFindMany,
  mockShotCreate,
  mockLocationFindFirst,
  mockVerifyEpisodeOwnership,
  mockVerifyProjectOwnership,
  mockCompositionFindFirst,
  mockCompositionCreate,
  mockCompositionSceneDeleteMany,
  mockCompositionSceneCreateMany,
  mockRunCompositionExport,
  mockEnqueueEpisodeStoryboardScriptJob,
  mockSceneGroupBy,
  mockSceneDialogueFindMany,
  mockCharacterShotFindMany,
  mockPipelineJobFindMany
} = vi.hoisted(() => {
  return {
    mockEpisodeFindMany: vi.fn(),
    mockEpisodeFindUnique: vi.fn(),
    mockEpisodeCreate: vi.fn(),
    mockEpisodeUpdate: vi.fn(),
    mockEpisodeDelete: vi.fn(),
    mockProjectFindFirst: vi.fn(),
    mockProjectFindUnique: vi.fn(),
    mockSceneDeleteMany: vi.fn(),
    mockSceneCreate: vi.fn(),
    mockSceneFindMany: vi.fn(),
    mockShotCreate: vi.fn(),
    mockLocationFindFirst: vi.fn(),
    mockVerifyEpisodeOwnership: vi.fn().mockResolvedValue(true),
    mockVerifyProjectOwnership: vi.fn().mockResolvedValue(true),
    mockCompositionFindFirst: vi.fn(),
    mockCompositionCreate: vi.fn(),
    mockCompositionSceneDeleteMany: vi.fn(),
    mockCompositionSceneCreateMany: vi.fn(),
    mockRunCompositionExport: vi.fn().mockResolvedValue({
      ok: true,
      outputUrl: 'https://storage.example.com/out.mp4',
      duration: 9
    }),
    mockEnqueueEpisodeStoryboardScriptJob: vi.fn(),
    mockSceneGroupBy: vi.fn().mockResolvedValue([]),
    mockSceneDialogueFindMany: vi.fn().mockResolvedValue([]),
    mockCharacterShotFindMany: vi.fn().mockResolvedValue([]),
    mockPipelineJobFindMany: vi.fn().mockResolvedValue([])
  }
})

// Mock deepseek（保留 hasEpisodeContentForStoryboard 等真实实现）
vi.mock('../src/services/ai/deepseek.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/services/ai/deepseek.js')>()
  return {
    ...mod,
    expandScript: vi.fn().mockResolvedValue({
      script: {
        title: 'Expanded Episode',
        summary: '',
        scenes: [{ sceneNum: 1, description: 'Scene 1', location: 'indoor' }]
      },
      cost: { costCNY: 0.05 }
    }),
    generateStoryboardScriptFromEpisode: vi.fn().mockResolvedValue({
      script: {
        title: 'Storyboard Ep',
        summary: 'sum',
        scenes: [
          {
            sceneNum: 1,
            description: 'Scene 1',
            location: 'indoor',
            timeOfDay: '日',
            characters: [],
            dialogues: [],
            actions: []
          }
        ]
      },
      cost: { costCNY: 0.03 }
    })
  }
})

vi.mock('../src/services/composition-export.js', () => ({
  runCompositionExport: (...args: unknown[]) => mockRunCompositionExport(...args)
}))

vi.mock('../src/services/episode-storyboard-job.js', () => ({
  enqueueEpisodeStoryboardScriptJob: (...args: unknown[]) =>
    mockEnqueueEpisodeStoryboardScriptJob(...args)
}))

// Mock verifyEpisodeOwnership and verifyProjectOwnership
vi.mock('../src/plugins/auth.js', () => ({
  verifyEpisodeOwnership: (...args: unknown[]) => mockVerifyEpisodeOwnership(...args),
  verifyProjectOwnership: (...args: unknown[]) => mockVerifyProjectOwnership(...args)
}))

// Mock the index.js module
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    episode: {
      findMany: mockEpisodeFindMany,
      findUnique: mockEpisodeFindUnique,
      create: mockEpisodeCreate,
      update: mockEpisodeUpdate,
      delete: mockEpisodeDelete
    },
    project: {
      findFirst: mockProjectFindFirst,
      findUnique: mockProjectFindUnique
    },
    scene: {
      deleteMany: mockSceneDeleteMany,
      create: mockSceneCreate,
      findMany: mockSceneFindMany,
      groupBy: mockSceneGroupBy
    },
    sceneDialogue: {
      findMany: mockSceneDialogueFindMany
    },
    characterShot: {
      findMany: mockCharacterShotFindMany
    },
    shot: {
      create: mockShotCreate
    },
    location: {
      findFirst: mockLocationFindFirst
    },
    composition: {
      findFirst: mockCompositionFindFirst,
      create: mockCompositionCreate
    },
    compositionScene: {
      deleteMany: mockCompositionSceneDeleteMany,
      createMany: mockCompositionSceneCreateMany
    },
    pipelineJob: {
      findMany: mockPipelineJobFindMany
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { episodeRoutes } from '../src/routes/episodes.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Episode Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(episodeRoutes, { prefix: '/api/episodes' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/episodes', () => {
    it('should return 403 when user does not own project', async () => {
      mockVerifyProjectOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes?projectId=proj-1'
      })

      expectPermissionDeniedPayload(response)
    })

    it('should return episodes for a project', async () => {
      const mockEpisodes = [
        { id: 'ep-1', episodeNum: 1, title: 'Episode 1' },
        { id: 'ep-2', episodeNum: 2, title: 'Episode 2' }
      ]
      mockEpisodeFindMany.mockResolvedValue(mockEpisodes)

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data[0].listStats).toMatchObject({
        scriptSceneCount: 0,
        scriptCharacterCount: 0,
        storyboardSceneCount: 0,
        storyboardCharacterCount: 0,
        hasStoryboardScenes: false,
        storyboardScriptJobCompleted: false
      })
    })

    it('should attach listStats from scene aggregates', async () => {
      mockEpisodeFindMany.mockResolvedValue([
        { id: 'ep-1', episodeNum: 1, title: 'E1', script: null }
      ])
      mockSceneGroupBy.mockResolvedValueOnce([{ episodeId: 'ep-1', _count: { _all: 3 } }])
      mockSceneDialogueFindMany.mockResolvedValueOnce([
        { characterId: 'c1', scene: { episodeId: 'ep-1' } },
        { characterId: 'c2', scene: { episodeId: 'ep-1' } }
      ])
      mockCharacterShotFindMany.mockResolvedValueOnce([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data[0].listStats).toMatchObject({
        storyboardSceneCount: 3,
        storyboardCharacterCount: 2,
        hasStoryboardScenes: true,
        storyboardScriptJobCompleted: false
      })
    })
  })

  describe('GET /api/episodes/:id', () => {
    it('should return episode details', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        projectId: 'proj-1',
        episodeNum: 1,
        title: 'Episode 1',
        scenes: []
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/ep-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('ep-1')
    })

    it('should return 404 when episode not found', async () => {
      mockEpisodeFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 when user does not own episode', async () => {
      mockVerifyEpisodeOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/ep-1'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('GET /api/episodes/:id/detail', () => {
    it('should return episode, scenes and project.visualStyle', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        projectId: 'proj-1',
        episodeNum: 1,
        title: 'Episode 1',
        script: null
      })
      mockSceneGroupBy.mockResolvedValueOnce([])
      mockSceneDialogueFindMany.mockResolvedValueOnce([])
      mockCharacterShotFindMany.mockResolvedValueOnce([])
      mockPipelineJobFindMany.mockResolvedValueOnce([])
      mockProjectFindUnique.mockResolvedValueOnce({ visualStyle: ['realistic', 'cinematic'] })
      mockSceneFindMany.mockResolvedValueOnce([
        {
          id: 'sc1',
          episodeId: 'ep-1',
          sceneNum: 1,
          description: 'd',
          duration: 5000,
          aspectRatio: '9:16',
          visualStyle: [],
          status: 'pending',
          location: null,
          shots: [],
          dialogues: [],
          takes: []
        }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/ep-1/detail'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.episode.id).toBe('ep-1')
      expect(data.project.visualStyle).toEqual(['realistic', 'cinematic'])
      expect(data.scenes).toHaveLength(1)
      expect(data.scenes[0].id).toBe('sc1')
    })

    it('should return 404 when episode not found', async () => {
      mockEpisodeFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/missing/detail'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/episodes/:id/scenes', () => {
    it('should return aggregated scenes for editor', async () => {
      mockSceneFindMany.mockResolvedValueOnce([
        {
          id: 'sc1',
          episodeId: 'ep-1',
          sceneNum: 1,
          description: 'd',
          duration: 5000,
          aspectRatio: '9:16',
          visualStyle: [],
          status: 'pending',
          location: null,
          shots: [],
          dialogues: [],
          takes: []
        }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/ep-1/scenes'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.scenes).toHaveLength(1)
      expect(data.scenes[0].id).toBe('sc1')
    })

    it('should return 403 when user does not own episode', async () => {
      mockVerifyEpisodeOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/ep-1/scenes'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('POST /api/episodes', () => {
    it('should create a new episode', async () => {
      const newEpisode = {
        id: 'ep-3',
        projectId: 'proj-1',
        episodeNum: 3,
        title: 'New Episode'
      }
      mockEpisodeCreate.mockResolvedValue(newEpisode)

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes',
        payload: {
          projectId: 'proj-1',
          episodeNum: 3,
          title: 'New Episode'
        }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('ep-3')
    })
  })

  describe('PUT /api/episodes/:id', () => {
    it('should update an episode', async () => {
      mockEpisodeUpdate.mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        title: 'Updated Title'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/episodes/ep-1',
        payload: {
          title: 'Updated Title'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.title).toBe('Updated Title')
    })

    it('should persist synopsis when provided', async () => {
      mockEpisodeUpdate.mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        synopsis: '本集梗概'
      })
      const response = await app.inject({
        method: 'PUT',
        url: '/api/episodes/ep-1',
        payload: { synopsis: '本集梗概' }
      })
      expect(response.statusCode).toBe(200)
      expect(mockEpisodeUpdate).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: expect.objectContaining({ synopsis: '本集梗概' })
      })
    })
  })

  describe('DELETE /api/episodes/:id', () => {
    it('should delete an episode', async () => {
      mockEpisodeFindUnique.mockResolvedValue({ id: 'ep-1' })
      mockEpisodeDelete.mockResolvedValue({ id: 'ep-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/episodes/ep-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should return 404 when episode not found', async () => {
      mockEpisodeFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/episodes/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/episodes/:id/compose', () => {
    it('returns 400 when no scenes', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        projectId: 'proj-1',
        title: 'E1',
        scenes: []
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-1/compose',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 when selected take missing video', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        projectId: 'proj-1',
        title: 'E1',
        scenes: [
          {
            id: 'sc-1',
            sceneNum: 1,
            takes: [{ id: 'tk-1', status: 'completed', videoUrl: null, isSelected: true }]
          }
        ]
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-1/compose',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    it('creates composition timeline and exports', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        projectId: 'proj-1',
        title: 'E1',
        scenes: [
          {
            id: 'sc-1',
            sceneNum: 1,
            takes: [
              {
                id: 'tk-1',
                status: 'completed',
                videoUrl: 'https://cdn.example.com/a.mp4',
                isSelected: true
              }
            ]
          }
        ]
      })
      mockCompositionFindFirst.mockResolvedValue(null)
      mockCompositionCreate.mockResolvedValue({ id: 'cmp-1' })
      mockCompositionSceneDeleteMany.mockResolvedValue({ count: 0 })
      mockCompositionSceneCreateMany.mockResolvedValue({ count: 1 })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-1/compose',
        payload: {}
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.compositionId).toBe('cmp-1')
      expect(data.outputUrl).toContain('out.mp4')
      expect(mockRunCompositionExport).toHaveBeenCalledWith('cmp-1')
    })
  })

  describe('POST /api/episodes/:id/expand', () => {
    it('should expand episode script with AI', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        title: 'Episode 1',
        projectId: 'proj-1'
      })
      mockProjectFindUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
        characters: [{ name: 'Alice', description: 'Young woman' }],
        episodes: []
      })
      mockEpisodeUpdate.mockResolvedValue({
        id: 'ep-1',
        title: 'Expanded Episode'
      })
      mockSceneDeleteMany.mockResolvedValue({ count: 0 })
      mockLocationFindFirst.mockResolvedValue(null)
      mockSceneCreate.mockImplementation((args: { data: { sceneNum: number } }) =>
        Promise.resolve({ id: `scene-${args.data.sceneNum}`, ...args.data })
      )
      mockShotCreate.mockResolvedValue({ id: 'shot-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-1/expand',
        payload: {
          summary: 'A story about a hero'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.episode).toBeDefined()
      expect(data.script).toBeDefined()
      expect(data.aiCost).toBeDefined()
    })

    it('should return 404 when episode not found', async () => {
      mockEpisodeFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/nonexistent/expand',
        payload: {
          summary: 'A story'
        }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/episodes/:id/generate-storyboard-script', () => {
    it('should enqueue storyboard script job', async () => {
      mockEnqueueEpisodeStoryboardScriptJob.mockResolvedValue({
        ok: true,
        jobId: 'job-sb-1'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-1/generate-storyboard-script',
        payload: {}
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.jobId).toBe('job-sb-1')
      expect(data.message).toBeDefined()
      expect(mockEnqueueEpisodeStoryboardScriptJob).toHaveBeenCalled()
    })

    it('should return 400 when enqueue reports content missing', async () => {
      mockEnqueueEpisodeStoryboardScriptJob.mockResolvedValue({
        ok: false,
        status: 400,
        error: '内容不足',
        message: '请先填写本集梗概'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-empty/generate-storyboard-script',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBeDefined()
    })

    it('should return 404 when episode not found', async () => {
      mockEnqueueEpisodeStoryboardScriptJob.mockResolvedValue({
        ok: false,
        status: 404,
        error: 'Episode not found'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/missing/generate-storyboard-script',
        payload: {}
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 409 when concurrent job exists', async () => {
      mockEnqueueEpisodeStoryboardScriptJob.mockResolvedValue({
        ok: false,
        status: 409,
        error: '该集已有进行中的分镜剧本生成任务，请稍后再试'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-1/generate-storyboard-script',
        payload: {}
      })

      expect(response.statusCode).toBe(409)
    })

    it('should return 409 when storyboard script already completed once', async () => {
      mockEnqueueEpisodeStoryboardScriptJob.mockResolvedValue({
        ok: false,
        status: 409,
        error: '本集已使用 AI 生成分镜脚本，仅支持操作一次'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep-1/generate-storyboard-script',
        payload: {}
      })

      expect(response.statusCode).toBe(409)
      const data = JSON.parse(response.payload)
      expect(data.error).toContain('仅支持操作一次')
    })
  })
})
