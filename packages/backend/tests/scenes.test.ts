import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockSceneFindMany,
  mockSceneFindUnique,
  mockSceneCreate,
  mockSceneUpdate,
  mockSceneDelete,
  mockShotCreate,
  mockShotUpdate,
  mockShotFindFirst,
  mockTakeCreate,
  mockTakeUpdateMany,
  mockTakeUpdate,
  mockTakeFindMany,
  mockEpisodeFindFirst,
  mockEpisodeFindUnique,
  mockVerifySceneOwnership,
  mockVerifyEpisodeOwnership
} = vi.hoisted(() => {
  return {
    mockSceneFindMany: vi.fn(),
    mockSceneFindUnique: vi.fn(),
    mockSceneCreate: vi.fn(),
    mockSceneUpdate: vi.fn(),
    mockSceneDelete: vi.fn(),
    mockShotCreate: vi.fn(),
    mockShotUpdate: vi.fn(),
    mockShotFindFirst: vi.fn(),
    mockTakeCreate: vi.fn(),
    mockTakeUpdateMany: vi.fn(),
    mockTakeUpdate: vi.fn(),
    mockTakeFindMany: vi.fn(),
    mockEpisodeFindFirst: vi.fn(),
    mockEpisodeFindUnique: vi.fn(),
    mockVerifySceneOwnership: vi.fn().mockResolvedValue(true),
    mockVerifyEpisodeOwnership: vi.fn().mockResolvedValue(true)
  }
})

vi.mock('../src/queues/video.js', () => ({
  videoQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' })
  }
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifySceneOwnership: (...args: unknown[]) => mockVerifySceneOwnership(...args),
  verifyEpisodeOwnership: (...args: unknown[]) => mockVerifyEpisodeOwnership(...args),
  getRequestUser: (request: any) => request.user,
  getRequestUserId: (request: any) => request.user?.id
}))

vi.mock('../src/services/ai/deepseek.js', () => ({
  optimizePrompt: vi.fn().mockResolvedValue({
    optimized: 'optimized prompt',
    cost: { costCNY: 0.01 }
  })
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    scene: {
      findMany: mockSceneFindMany,
      findUnique: mockSceneFindUnique,
      create: mockSceneCreate,
      update: mockSceneUpdate,
      delete: mockSceneDelete
    },
    shot: {
      create: mockShotCreate,
      update: mockShotUpdate,
      findFirst: mockShotFindFirst
    },
    take: {
      create: mockTakeCreate,
      updateMany: mockTakeUpdateMany,
      update: mockTakeUpdate,
      findMany: mockTakeFindMany
    },
    episode: {
      findFirst: mockEpisodeFindFirst,
      findUnique: mockEpisodeFindUnique
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { sceneRoutes } from '../src/routes/scenes.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Scene Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(sceneRoutes, { prefix: '/api/scenes' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/scenes', () => {
    it('should return 403 when user does not own episode', async () => {
      mockVerifyEpisodeOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/scenes?episodeId=ep-1'
      })

      expectPermissionDeniedPayload(response)
    })

    it('should return scenes for an episode', async () => {
      const mockScenes = [{ id: 'scene-1', sceneNum: 1, description: 'Test', takes: [] }]
      mockSceneFindMany.mockResolvedValue(mockScenes)

      const response = await app.inject({
        method: 'GET',
        url: '/api/scenes?episodeId=ep-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(1)
    })
  })

  describe('GET /api/scenes/:id', () => {
    it('should return scene details', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        sceneNum: 1,
        description: 'Test scene',
        takes: [],
        shots: []
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/scenes/scene-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('scene-1')
    })

    it('should return 404 when scene not found', async () => {
      mockSceneFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/scenes/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 when user does not own scene', async () => {
      mockVerifySceneOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/scenes/scene-1'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('POST /api/scenes', () => {
    it('should create a new scene', async () => {
      const newScene = {
        id: 'scene-2',
        episodeId: 'ep-1',
        sceneNum: 2,
        description: 'New scene'
      }
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        projectId: 'p1',
        project: { aspectRatio: '9:16' }
      })
      mockSceneCreate.mockResolvedValue(newScene)
      mockShotCreate.mockResolvedValue({ id: 'shot-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes',
        payload: {
          episodeId: 'ep-1',
          sceneNum: 2,
          description: 'New scene',
          prompt: 'test prompt'
        }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('scene-2')
      expect(mockShotCreate).toHaveBeenCalled()
    })
  })

  describe('PUT /api/scenes/:id', () => {
    it('should update a scene', async () => {
      mockSceneUpdate.mockResolvedValue({
        id: 'scene-1',
        sceneNum: 1,
        description: 'Updated'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/scenes/scene-1',
        payload: {
          description: 'Updated'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.description).toBe('Updated')
    })
  })

  describe('DELETE /api/scenes/:id', () => {
    it('should delete a scene', async () => {
      mockSceneFindUnique.mockResolvedValue({ id: 'scene-1' })
      mockSceneDelete.mockResolvedValue({ id: 'scene-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/scenes/scene-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should return 404 when scene not found', async () => {
      mockSceneFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/scenes/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/scenes/:id/generate', () => {
    it('should create video generation task', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        sceneNum: 1,
        description: 'test prompt',
        shots: []
      })
      mockTakeCreate.mockResolvedValue({ id: 'task-1', status: 'queued' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/generate',
        payload: {
          model: 'wan2.6'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.taskId).toBeDefined()
    })
  })

  describe('POST /api/scenes/:id/optimize-prompt', () => {
    it('should optimize scene prompt', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        description: 'original prompt',
        episode: {
          project: {
            characters: []
          }
        },
        shots: [{ id: 'shot-1', order: 1, shotNum: 1, description: 'x' }]
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/optimize-prompt',
        payload: {}
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.optimizedPrompt).toBeDefined()
    })

    it('should return 404 when scene not found', async () => {
      mockSceneFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/nonexistent/optimize-prompt',
        payload: {}
      })

      expect(response.statusCode).toBe(404)
    })

    it('should handle characters context', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        description: 'original prompt',
        episode: {
          project: {
            characters: [
              { name: 'Alice', description: 'Young woman' },
              { name: 'Bob', description: 'Old man' }
            ]
          }
        },
        shots: []
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/optimize-prompt',
        payload: {}
      })

      expect(response.statusCode).toBe(200)
    })

    it('should not update shot when custom prompt is provided', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        description: 'original prompt',
        episode: {
          project: {
            characters: []
          }
        },
        shots: [{ id: 'shot-1', order: 1, shotNum: 1, description: 'x' }]
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/optimize-prompt',
        payload: {
          prompt: 'custom prompt to optimize'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(mockShotUpdate).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/scenes/batch-generate', () => {
    it('should create tasks for multiple scenes', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        description: 'test prompt',
        shots: []
      })
      mockTakeCreate.mockResolvedValue({ id: 'task-1', status: 'queued' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/batch-generate',
        payload: {
          sceneIds: ['scene-1', 'scene-2'],
          model: 'wan2.6'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('POST /api/scenes/:id/tasks/:taskId/select', () => {
    it('should select a task as final version', async () => {
      mockTakeUpdateMany.mockResolvedValue({ count: 2 })
      mockTakeUpdate.mockResolvedValue({ id: 'task-1', isSelected: true })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/tasks/task-1/select'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /api/scenes/:id/tasks', () => {
    it('should return all tasks for a scene', async () => {
      mockTakeFindMany.mockResolvedValue([
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'failed' }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/scenes/scene-1/tasks'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
    })
  })
})
