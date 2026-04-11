import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockVideoTaskFindUnique,
  mockSegmentFindMany,
  mockVideoTaskUpdate,
  mockSegmentUpdate,
  mockVideoTaskCreate,
  mockEpisodeFindFirst,
  mockSegmentFindFirst
} = vi.hoisted(() => {
  return {
    mockVideoTaskFindUnique: vi.fn(),
    mockSegmentFindMany: vi.fn(),
    mockVideoTaskUpdate: vi.fn(),
    mockSegmentUpdate: vi.fn(),
    mockVideoTaskCreate: vi.fn(),
    mockEpisodeFindFirst: vi.fn(),
    mockSegmentFindFirst: vi.fn()
  }
})

// Mock video queue
vi.mock('../src/queues/video.js', () => ({
  videoQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' })
  }
}))

// Mock verifyTaskOwnership and verifyProjectOwnership
vi.mock('../src/plugins/auth.js', () => ({
  verifyTaskOwnership: vi.fn().mockResolvedValue(true),
  verifyProjectOwnership: vi.fn().mockResolvedValue(true)
}))

// Mock the index.js module
vi.mock('../src/index.js', () => ({
  prisma: {
    videoTask: {
      findUnique: mockVideoTaskFindUnique,
      update: mockVideoTaskUpdate,
      create: mockVideoTaskCreate
    },
    segment: {
      findMany: mockSegmentFindMany,
      update: mockSegmentUpdate,
      findFirst: mockSegmentFindFirst
    },
    episode: {
      findFirst: mockEpisodeFindFirst
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { taskRoutes } from '../src/routes/tasks.js'

describe('Task Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(taskRoutes, { prefix: '/api/tasks' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/tasks/:id', () => {
    it('should return task details', async () => {
      const mockTask = {
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'completed',
        model: 'wan2.6'
      }
      mockVideoTaskFindUnique.mockResolvedValue(mockTask)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/task-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('task-1')
    })

    it('should return 404 when task not found', async () => {
      mockVideoTaskFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/tasks', () => {
    it('should return tasks for project', async () => {
      const mockScenes = [
        {
          id: 'scene-1',
          sceneNum: 1,
          description: 'Test scene',
          tasks: [
            { id: 'task-1', status: 'completed', model: 'wan2.6' }
          ]
        }
      ]
      mockSegmentFindMany.mockResolvedValue(mockScenes)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('POST /api/tasks/:id/cancel', () => {
    it('should cancel a pending task', async () => {
      mockVideoTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'processing'
      })
      mockVideoTaskUpdate.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
        errorMsg: 'Cancelled by user'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/task-1/cancel'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.status).toBe('failed')
    })

    it('should return 400 when trying to cancel completed task', async () => {
      mockVideoTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'completed'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/task-1/cancel'
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Cannot cancel a completed or failed task')
    })

    it('should return 400 when trying to cancel already failed task', async () => {
      mockVideoTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'failed'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/task-1/cancel'
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 404 when task not found', async () => {
      mockVideoTaskFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/nonexistent/cancel'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/tasks/:id/retry', () => {
    it('should retry a failed task', async () => {
      mockVideoTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'failed',
        model: 'wan2.6',
        prompt: 'test prompt'
      })
      mockVideoTaskCreate.mockResolvedValue({
        id: 'task-2',
        sceneId: 'scene-1',
        status: 'queued'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/task-1/retry'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBeDefined()
    })

    it('should return 400 when trying to retry non-failed task', async () => {
      mockVideoTaskFindUnique.mockResolvedValue({
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'completed'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/task-1/retry'
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Can only retry failed tasks')
    })

    it('should return 404 when task not found', async () => {
      mockVideoTaskFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/nonexistent/retry'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
