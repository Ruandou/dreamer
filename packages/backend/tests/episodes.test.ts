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
  mockSegmentDeleteMany,
  mockSegmentCreateMany
} = vi.hoisted(() => {
  return {
    mockEpisodeFindMany: vi.fn(),
    mockEpisodeFindUnique: vi.fn(),
    mockEpisodeCreate: vi.fn(),
    mockEpisodeUpdate: vi.fn(),
    mockEpisodeDelete: vi.fn(),
    mockProjectFindFirst: vi.fn(),
    mockProjectFindUnique: vi.fn(),
    mockSegmentDeleteMany: vi.fn(),
    mockSegmentCreateMany: vi.fn()
  }
})

// Mock deepseek
vi.mock('../src/services/deepseek.js', () => ({
  expandScript: vi.fn().mockResolvedValue({
    script: {
      title: 'Expanded Episode',
      scenes: [
        { sceneNum: 1, description: 'Scene 1', location: 'indoor' }
      ]
    },
    cost: { costCNY: 0.05 }
  })
}))

// Mock verifyEpisodeOwnership and verifyProjectOwnership
vi.mock('../src/plugins/auth.js', () => ({
  verifyEpisodeOwnership: vi.fn().mockResolvedValue(true),
  verifyProjectOwnership: vi.fn().mockResolvedValue(true)
}))

// Mock the index.js module
vi.mock('../src/index.js', () => ({
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
    segment: {
      deleteMany: mockSegmentDeleteMany,
      createMany: mockSegmentCreateMany
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { episodeRoutes } from '../src/routes/episodes.js'

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
    })
  })

  describe('GET /api/episodes/:id', () => {
    it('should return episode details', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
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
})
