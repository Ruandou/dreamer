import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockProjectFindUnique,
  mockProjectFindMany,
  mockTakeFindMany,
  mockCharacterImageAggregate,
  mockLocationAggregate,
  mockCharacterImageFindMany,
  mockLocationFindMany
} = vi.hoisted(() => {
  return {
    mockProjectFindUnique: vi.fn(),
    mockProjectFindMany: vi.fn(),
    mockTakeFindMany: vi.fn(),
    mockCharacterImageAggregate: vi.fn().mockResolvedValue({ _sum: { imageCost: null } }),
    mockLocationAggregate: vi.fn().mockResolvedValue({ _sum: { imageCost: null } }),
    mockCharacterImageFindMany: vi.fn().mockResolvedValue([]),
    mockLocationFindMany: vi.fn().mockResolvedValue([])
  }
})

// Mock deepseek
vi.mock('../src/services/ai/deepseek.js', () => ({
  getDeepSeekBalance: vi.fn().mockResolvedValue({
    isAvailable: true,
    balanceInfos: [{ currency: 'CNY', totalBalance: 10.5, grantedBalance: 5, toppedUpBalance: 5.5 }]
  })
}))

// Mock the index.js module
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    project: {
      findUnique: mockProjectFindUnique,
      findMany: mockProjectFindMany
    },
    take: {
      findMany: mockTakeFindMany
    },
    characterImage: {
      aggregate: mockCharacterImageAggregate,
      findMany: mockCharacterImageFindMany
    },
    location: {
      aggregate: mockLocationAggregate,
      findMany: mockLocationFindMany
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { statsRoutes } from '../src/routes/stats.js'

describe('Stats Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(statsRoutes, { prefix: '/api/stats' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/stats/projects/:projectId', () => {
    it('should return project stats', async () => {
      mockProjectFindUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
        episodes: [
          {
            scenes: [
              {
                takes: [
                  {
                    id: 'task-1',
                    model: 'wan2.6',
                    status: 'completed',
                    cost: 0.5,
                    createdAt: new Date()
                  }
                ]
              }
            ]
          }
        ],
        importTasks: [{ status: 'completed', result: { aiCost: 0.1 } }]
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/projects/p?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.projectId).toBe('proj-1')
      expect(data.projectName).toBe('Test Project')
    })

    it('should return 404 when project not found', async () => {
      mockProjectFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/projects/p?projectId=nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/stats/me', () => {
    it('should return user stats', async () => {
      mockProjectFindMany.mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Test Project',
          episodes: [
            {
              scenes: [
                {
                  takes: [
                    {
                      id: 'task-1',
                      model: 'wan2.6',
                      status: 'completed',
                      cost: 0.5,
                      createdAt: new Date()
                    }
                  ]
                }
              ]
            }
          ],
          importTasks: []
        }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/me'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.userId).toBe('test-user-id')
      expect(data.totalProjects).toBe(1)
    })
  })

  describe('GET /api/stats/trend', () => {
    it('should return daily cost trend', async () => {
      mockTakeFindMany.mockResolvedValue([
        { id: 'task-1', model: 'wan2.6', cost: 0.5, createdAt: new Date() },
        { id: 'task-2', model: 'seedance2.0', cost: 1.0, createdAt: new Date() }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/trend?days=30'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('GET /api/stats/ai-balance', () => {
    it('should return AI balance', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/ai-balance'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.isAvailable).toBe(true)
    })
  })

  describe('GET /api/stats/trend', () => {
    it('should return empty trend when no tasks', async () => {
      mockTakeFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/trend'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
    })

    it('should filter by projectId', async () => {
      mockTakeFindMany.mockResolvedValue([
        { id: 'task-1', model: 'wan2.6', cost: 0.5, createdAt: new Date() }
      ])

      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/trend?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
    })
  })
})
