import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockMemoryItemFindMany,
  mockMemoryItemFindUnique,
  mockMemoryItemCreate,
  mockMemoryItemUpdate,
  mockMemoryItemDelete,
  mockMemoryItemCount,
  mockMemoryItemCreateMany,
  mockMemoryItemUpdateMany,
  mockMemorySnapshotUpsert,
  mockMemorySnapshotFindFirst,
  mockProjectFindFirst
} = vi.hoisted(() => {
  return {
    mockMemoryItemFindMany: vi.fn(),
    mockMemoryItemFindUnique: vi.fn(),
    mockMemoryItemCreate: vi.fn(),
    mockMemoryItemUpdate: vi.fn(),
    mockMemoryItemDelete: vi.fn(),
    mockMemoryItemCount: vi.fn(),
    mockMemoryItemCreateMany: vi.fn(),
    mockMemoryItemUpdateMany: vi.fn(),
    mockMemorySnapshotUpsert: vi.fn(),
    mockMemorySnapshotFindFirst: vi.fn(),
    mockProjectFindFirst: vi.fn()
  }
})

// Mock verifyProjectOwnership
const mockVerifyProjectOwnership = vi.fn().mockResolvedValue(true)

vi.mock('../src/plugins/auth.js', () => ({
  verifyProjectOwnership: (...args: any[]) => mockVerifyProjectOwnership(...args),
  getRequestUser: (request: any) => request.user,
  getRequestUserId: (request: any) => request.user?.id
}))

// Mock the prisma module
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    memoryItem: {
      findMany: mockMemoryItemFindMany,
      findUnique: mockMemoryItemFindUnique,
      create: mockMemoryItemCreate,
      update: mockMemoryItemUpdate,
      delete: mockMemoryItemDelete,
      count: mockMemoryItemCount,
      createMany: mockMemoryItemCreateMany,
      updateMany: mockMemoryItemUpdateMany
    },
    memorySnapshot: {
      upsert: mockMemorySnapshotUpsert,
      findFirst: mockMemorySnapshotFindFirst
    },
    project: {
      findFirst: mockProjectFindFirst
    },
    episode: {
      findUnique: vi.fn()
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Mock LLM service for extraction to prevent actual API calls
vi.mock('../src/services/ai/deepseek.js', () => ({
  extractMemoriesWithLLM: vi.fn().mockResolvedValue({
    memories: [],
    cost: { inputTokens: 0, outputTokens: 0, costCNY: 0 }
  })
}))

// Import routes after all mocks are set up
import { memoryRoutes } from '../src/routes/memories.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Memory Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(memoryRoutes, { prefix: '/api/projects' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/projects/:projectId/memories', () => {
    it('should return memories for a project', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          type: 'CHARACTER',
          title: '李明',
          content: '30岁科学家',
          projectId: 'proj-1',
          importance: 5,
          isActive: true,
          tags: ['主角'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      mockMemoryItemFindMany.mockResolvedValue(mockMemories)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.count).toBe(1)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe('mem-1')
    })

    it('should filter memories by type', async () => {
      mockMemoryItemFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories?type=CHARACTER'
      })

      expect(response.statusCode).toBe(200)
      expect(mockMemoryItemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'CHARACTER'
          })
        })
      )
    })

    it('should filter memories by isActive', async () => {
      mockMemoryItemFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories?isActive=true'
      })

      expect(response.statusCode).toBe(200)
      expect(mockMemoryItemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true
          })
        })
      )
    })

    it('should filter memories by minImportance', async () => {
      mockMemoryItemFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories?minImportance=4'
      })

      expect(response.statusCode).toBe(200)
      expect(mockMemoryItemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            importance: { gte: 4 }
          })
        })
      )
    })

    it('should return 403 when user does not own project', async () => {
      mockVerifyProjectOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('GET /api/projects/:projectId/memories/:memoryId', () => {
    it('should return a single memory', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          type: 'CHARACTER',
          title: '李明',
          content: '30岁科学家',
          projectId: 'proj-1',
          importance: 5,
          isActive: true,
          tags: ['主角'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      mockMemoryItemFindMany.mockResolvedValue(mockMemories)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories/mem-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('mem-1')
    })

    it('should return 404 when memory not found', async () => {
      mockMemoryItemFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 when user does not own project', async () => {
      mockVerifyProjectOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories/mem-1'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('POST /api/projects/:projectId/memories/search', () => {
    it('should search memories by text', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          type: 'CHARACTER',
          title: '李明',
          content: '30岁科学家',
          projectId: 'proj-1',
          importance: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      mockMemoryItemFindMany.mockResolvedValue(mockMemories)

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/proj-1/memories/search',
        payload: {
          query: '科学家'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.count).toBe(1)
    })

    it('should return 400 when query is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/proj-1/memories/search',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 403 when user does not own project', async () => {
      mockVerifyProjectOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/proj-1/memories/search',
        payload: {
          query: '测试'
        }
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('GET /api/projects/:projectId/memories/context', () => {
    it('should return writing context for an episode', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          type: 'CHARACTER',
          title: '李明',
          content: '30岁科学家',
          projectId: 'proj-1',
          importance: 5,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      mockMemoryItemFindMany.mockResolvedValue(mockMemories)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories/context?episodeNum=1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
    })

    it('should return 403 when user does not own project', async () => {
      mockVerifyProjectOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories/context?episodeNum=1'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('GET /api/projects/:projectId/memories/stats', () => {
    it('should return memory statistics', async () => {
      const mockMemories = [
        {
          id: '1',
          type: 'CHARACTER',
          importance: 5,
          isActive: true,
          verified: true
        },
        {
          id: '2',
          type: 'CHARACTER',
          importance: 4,
          isActive: true,
          verified: false
        },
        {
          id: '3',
          type: 'CHARACTER',
          importance: 3,
          isActive: false,
          verified: false
        },
        {
          id: '4',
          type: 'LOCATION',
          importance: 5,
          isActive: true,
          verified: true
        },
        {
          id: '5',
          type: 'LOCATION',
          importance: 2,
          isActive: true,
          verified: false
        },
        {
          id: '6',
          type: 'EVENT',
          importance: 4,
          isActive: true,
          verified: true
        },
        {
          id: '7',
          type: 'EVENT',
          importance: 3,
          isActive: true,
          verified: false
        },
        {
          id: '8',
          type: 'EVENT',
          importance: 5,
          isActive: false,
          verified: true
        },
        {
          id: '9',
          type: 'EVENT',
          importance: 2,
          isActive: true,
          verified: false
        },
        {
          id: '10',
          type: 'FORESHADOWING',
          importance: 4,
          isActive: true,
          verified: true
        }
      ]
      mockMemoryItemFindMany.mockResolvedValue(mockMemories)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories/stats'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.data.total).toBe(10)
      expect(data.data.active).toBe(8)
      expect(data.data.verified).toBe(5)
    })

    it('should return 403 when user does not own project', async () => {
      mockVerifyProjectOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1/memories/stats'
      })

      expectPermissionDeniedPayload(response)
    })
  })
})
