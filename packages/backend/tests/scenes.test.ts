import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockSceneFindMany,
  mockSceneFindUnique,
  mockSceneCreate,
  mockSceneUpdate,
  mockSceneDelete,
  mockVideoTaskCreate,
  mockVideoTaskUpdateMany,
  mockVideoTaskUpdate,
  mockVideoTaskFindMany,
  mockEpisodeFindFirst
} = vi.hoisted(() => {
  return {
    mockSceneFindMany: vi.fn(),
    mockSceneFindUnique: vi.fn(),
    mockSceneCreate: vi.fn(),
    mockSceneUpdate: vi.fn(),
    mockSceneDelete: vi.fn(),
    mockVideoTaskCreate: vi.fn(),
    mockVideoTaskUpdateMany: vi.fn(),
    mockVideoTaskUpdate: vi.fn(),
    mockVideoTaskFindMany: vi.fn(),
    mockEpisodeFindFirst: vi.fn()
  }
})

// Mock videoQueue
vi.mock('../src/queues/video.js', () => ({
  videoQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' })
  }
}))

// Mock verifySceneOwnership and verifyEpisodeOwnership
vi.mock('../src/plugins/auth.js', () => ({
  verifySceneOwnership: vi.fn().mockResolvedValue(true),
  verifyEpisodeOwnership: vi.fn().mockResolvedValue(true)
}))

// Mock deepseek
vi.mock('../src/services/deepseek.js', () => ({
  optimizePrompt: vi.fn().mockResolvedValue({
    optimized: 'optimized prompt',
    cost: { costCNY: 0.01 }
  })
}))

// Mock the index.js module
vi.mock('../src/index.js', () => ({
  prisma: {
    scene: {
      findMany: mockSceneFindMany,
      findUnique: mockSceneFindUnique,
      create: mockSceneCreate,
      update: mockSceneUpdate,
      delete: mockSceneDelete
    },
    videoTask: {
      create: mockVideoTaskCreate,
      updateMany: mockVideoTaskUpdateMany,
      update: mockVideoTaskUpdate,
      findMany: mockVideoTaskFindMany
    },
    episode: {
      findFirst: mockEpisodeFindFirst
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { sceneRoutes } from '../src/routes/scenes.js'

describe('Scene Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
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
    it('should return scenes for an episode', async () => {
      const mockScenes = [
        { id: 'scene-1', sceneNum: 1, description: 'Test', tasks: [] }
      ]
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
        tasks: []
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
  })

  describe('POST /api/scenes', () => {
    it('should create a new scene', async () => {
      const newScene = {
        id: 'scene-2',
        episodeId: 'ep-1',
        sceneNum: 2,
        description: 'New scene',
        prompt: 'test prompt'
      }
      mockSceneCreate.mockResolvedValue(newScene)

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
    })
  })

  describe('PUT /api/scenes/:id', () => {
    it('should update a scene', async () => {
      mockSceneUpdate.mockResolvedValue({
        id: 'scene-1',
        sceneNum: 1,
        description: 'Updated',
        prompt: 'updated prompt'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/scenes/scene-1',
        payload: {
          description: 'Updated',
          prompt: 'updated prompt'
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
        prompt: 'test prompt'
      })
      mockVideoTaskCreate.mockResolvedValue({ id: 'task-1', status: 'queued' })

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
        prompt: 'original prompt',
        episode: {
          project: {
            characters: []
          }
        }
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
        prompt: 'original prompt',
        episode: {
          project: {
            characters: [
              { name: 'Alice', description: 'Young woman' },
              { name: 'Bob', description: 'Old man' }
            ]
          }
        }
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/optimize-prompt',
        payload: {}
      })

      expect(response.statusCode).toBe(200)
    })

    it('should not update scene when custom prompt is provided', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        prompt: 'original prompt',
        episode: {
          project: {
            characters: []
          }
        }
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/optimize-prompt',
        payload: {
          prompt: 'custom prompt to optimize'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(mockSceneUpdate).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/scenes/batch-generate', () => {
    it('should create tasks for multiple scenes', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        prompt: 'test prompt'
      })
      mockVideoTaskCreate.mockResolvedValue({ id: 'task-1', status: 'queued' })

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
      mockVideoTaskUpdateMany.mockResolvedValue({ count: 2 })
      mockVideoTaskCreate.mockResolvedValue({ id: 'task-1', isSelected: true })

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes/scene-1/tasks/task-1/select'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /api/scenes/:id/tasks', () => {
    it('should return all tasks for a scene', async () => {
      mockVideoTaskFindMany.mockResolvedValue([
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
