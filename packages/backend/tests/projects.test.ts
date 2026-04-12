import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockProjectFindMany,
  mockProjectFindFirst,
  mockProjectCreate,
  mockProjectUpdate,
  mockProjectDelete
} = vi.hoisted(() => {
  return {
    mockProjectFindMany: vi.fn(),
    mockProjectFindFirst: vi.fn(),
    mockProjectCreate: vi.fn(),
    mockProjectUpdate: vi.fn(),
    mockProjectDelete: vi.fn()
  }
})

// Mock the index.js module
vi.mock('../src/index.js', () => ({
  prisma: {
    project: {
      findMany: mockProjectFindMany,
      findFirst: mockProjectFindFirst,
      create: mockProjectCreate,
      update: mockProjectUpdate,
      delete: mockProjectDelete
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { projectRoutes } from '../src/routes/projects.js'

describe('Project Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', vi.fn().mockImplementation(async (request: any, reply: any) => {
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
  })

  describe('GET /api/projects', () => {
    it('should return user projects', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Project 1', userId: 'test-user-id' },
        { id: 'proj-2', name: 'Project 2', userId: 'test-user-id' }
      ]
      mockProjectFindMany.mockResolvedValue(mockProjects)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(mockProjectFindMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        orderBy: { createdAt: 'desc' }
      })
    })

    it('should return empty array when no projects', async () => {
      mockProjectFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should return project details', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
        userId: 'test-user-id',
        episodes: [],
        characters: [],
        compositions: []
      }
      mockProjectFindFirst.mockResolvedValue(mockProject)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('proj-1')
      expect(data.name).toBe('Test Project')
    })

    it('should return 404 when project not found', async () => {
      mockProjectFindFirst.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent'
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Project not found')
    })
  })

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const newProject = {
        id: 'proj-3',
        name: 'New Project',
        description: 'Test description',
        userId: 'test-user-id'
      }
      mockProjectCreate.mockResolvedValue(newProject)

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
          name: 'New Project',
          description: 'Test description'
        }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('proj-3')
      expect(data.name).toBe('New Project')
    })
  })

  describe('PUT /api/projects/:id', () => {
    it('should update a project', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'proj-1',
        name: 'Original Name',
        userId: 'test-user-id'
      })
      mockProjectUpdate.mockResolvedValue({
        id: 'proj-1',
        name: 'Updated Name',
        userId: 'test-user-id'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/projects/proj-1',
        payload: {
          name: 'Updated Name'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('Updated Name')
    })

    it('should return 404 when updating non-existent project', async () => {
      mockProjectFindFirst.mockResolvedValue(null)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/projects/nonexistent',
        payload: {
          name: 'Updated Name'
        }
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Project not found')
    })

    it('should persist synopsis and visualStyle', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'proj-1',
        name: 'P',
        userId: 'test-user-id'
      })
      mockProjectUpdate.mockResolvedValue({
        id: 'proj-1',
        name: 'P',
        synopsis: '梗概',
        visualStyle: ['cinematic'],
        userId: 'test-user-id'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/projects/proj-1',
        payload: {
          synopsis: '梗概',
          visualStyle: ['cinematic']
        }
      })

      expect(response.statusCode).toBe(200)
      expect(mockProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { synopsis: '梗概', visualStyle: ['cinematic'] }
      })
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'proj-1',
        name: 'To Delete',
        userId: 'test-user-id'
      })
      mockProjectDelete.mockResolvedValue({ id: 'proj-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/projects/proj-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should return 404 when deleting non-existent project', async () => {
      mockProjectFindFirst.mockResolvedValue(null)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/projects/nonexistent'
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Project not found')
    })
  })
})
