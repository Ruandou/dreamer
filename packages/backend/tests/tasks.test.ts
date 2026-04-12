import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockTakeFindUnique,
  mockSceneFindMany,
  mockTakeUpdate,
  mockSceneUpdate,
  mockTakeCreate,
  mockVerifyTaskOwnership,
  mockVerifyProjectOwnership
} = vi.hoisted(() => {
  return {
    mockTakeFindUnique: vi.fn(),
    mockSceneFindMany: vi.fn(),
    mockTakeUpdate: vi.fn(),
    mockSceneUpdate: vi.fn(),
    mockTakeCreate: vi.fn(),
    mockVerifyTaskOwnership: vi.fn().mockResolvedValue(true),
    mockVerifyProjectOwnership: vi.fn().mockResolvedValue(true)
  }
})

vi.mock('../src/queues/video.js', () => ({
  videoQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' })
  }
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifyTaskOwnership: (...args: unknown[]) => mockVerifyTaskOwnership(...args),
  verifyProjectOwnership: (...args: unknown[]) => mockVerifyProjectOwnership(...args)
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    take: {
      findUnique: mockTakeFindUnique,
      update: mockTakeUpdate,
      create: mockTakeCreate
    },
    scene: {
      findMany: mockSceneFindMany,
      update: mockSceneUpdate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { taskRoutes } from '../src/routes/tasks.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Task Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    app.decorate('authenticate', async (request: any) => {
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
      mockTakeFindUnique.mockResolvedValue(mockTask)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/task-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('task-1')
    })

    it('should return 404 when task not found', async () => {
      mockTakeFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 when user does not own task', async () => {
      mockVerifyTaskOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/task-1'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('GET /api/tasks', () => {
    it('should return 403 when user does not own project', async () => {
      mockVerifyProjectOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks?projectId=proj-1'
      })

      expectPermissionDeniedPayload(response)
    })

    it('should return tasks for project', async () => {
      const mockScenes = [
        {
          id: 'scene-1',
          sceneNum: 1,
          description: 'Test scene',
          takes: [{ id: 'task-1', status: 'completed', model: 'wan2.6', createdAt: new Date() }]
        }
      ]
      mockSceneFindMany.mockResolvedValue(mockScenes)

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
      mockTakeFindUnique.mockResolvedValue({
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'processing'
      })
      mockTakeUpdate.mockResolvedValue({
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
      mockTakeFindUnique.mockResolvedValue({
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
      mockTakeFindUnique.mockResolvedValue({
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
      mockTakeFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/nonexistent/cancel'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/tasks/:id/retry', () => {
    it('should retry a failed task', async () => {
      mockTakeFindUnique.mockResolvedValue({
        id: 'task-1',
        sceneId: 'scene-1',
        status: 'failed',
        model: 'wan2.6',
        prompt: 'test prompt'
      })
      mockTakeCreate.mockResolvedValue({
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
      mockTakeFindUnique.mockResolvedValue({
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
      mockTakeFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/nonexistent/retry'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
