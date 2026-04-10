import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockCompositionFindMany,
  mockCompositionFindUnique,
  mockCompositionCreate,
  mockCompositionUpdate,
  mockCompositionDelete,
  mockSegmentFindMany,
  mockSegmentCreateMany,
  mockSegmentDeleteMany,
  mockVideoTaskFindFirst,
  mockProjectFindFirst
} = vi.hoisted(() => {
  return {
    mockCompositionFindMany: vi.fn(),
    mockCompositionFindUnique: vi.fn(),
    mockCompositionCreate: vi.fn(),
    mockCompositionUpdate: vi.fn(),
    mockCompositionDelete: vi.fn(),
    mockSegmentFindMany: vi.fn(),
    mockSegmentCreateMany: vi.fn(),
    mockSegmentDeleteMany: vi.fn(),
    mockVideoTaskFindFirst: vi.fn(),
    mockProjectFindFirst: vi.fn()
  }
})

// Mock ffmpeg service
vi.mock('../src/services/ffmpeg.js', () => ({
  composeVideo: vi.fn().mockResolvedValue({ outputPath: '/tmp/output.mp4' })
}))

// Mock storage service
vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://storage.example.com/output.mp4'),
  generateFileKey: vi.fn().mockReturnValue('compositions/output.mp4')
}))

// Mock verifyCompositionOwnership and verifyProjectOwnership
const mockVerifyCompositionOwnership = vi.fn().mockResolvedValue(true)
const mockVerifyProjectOwnership = vi.fn().mockResolvedValue(true)

vi.mock('../src/plugins/auth.js', () => ({
  verifyCompositionOwnership: (...args: any[]) => mockVerifyCompositionOwnership(...args),
  verifyProjectOwnership: (...args: any[]) => mockVerifyProjectOwnership(...args)
}))

// Mock the index.js module
vi.mock('../src/index.js', () => ({
  prisma: {
    composition: {
      findMany: mockCompositionFindMany,
      findUnique: mockCompositionFindUnique,
      create: mockCompositionCreate,
      update: mockCompositionUpdate,
      delete: mockCompositionDelete
    },
    segment: {
      findMany: mockSegmentFindMany,
      createMany: mockSegmentCreateMany,
      deleteMany: mockSegmentDeleteMany
    },
    videoTask: {
      findFirst: mockVideoTaskFindFirst
    },
    project: {
      findFirst: mockProjectFindFirst
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { compositionRoutes } from '../src/routes/compositions.js'

describe('Composition Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(compositionRoutes, { prefix: '/api/compositions' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/compositions', () => {
    it('should return compositions for a project', async () => {
      const mockCompositions = [
        { id: 'comp-1', title: 'Composition 1', segments: [] }
      ]
      mockCompositionFindMany.mockResolvedValue(mockCompositions)

      const response = await app.inject({
        method: 'GET',
        url: '/api/compositions?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(1)
    })
  })

  describe('GET /api/compositions/:id', () => {
    it('should return composition details', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        segments: []
      })
      mockVideoTaskFindFirst.mockResolvedValue({
        videoUrl: 'https://storage.example.com/video.mp4'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/compositions/comp-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('comp-1')
    })

    it('should return 404 when composition not found', async () => {
      mockCompositionFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/compositions/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 when user does not own composition', async () => {
      mockVerifyCompositionOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/compositions/comp-1'
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('POST /api/compositions', () => {
    it('should create a new composition', async () => {
      const newComposition = {
        id: 'comp-2',
        projectId: 'proj-1',
        title: 'New Composition'
      }
      mockCompositionCreate.mockResolvedValue(newComposition)

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions',
        payload: {
          projectId: 'proj-1',
          title: 'New Composition'
        }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('comp-2')
    })
  })

  describe('PUT /api/compositions/:id', () => {
    it('should update a composition', async () => {
      mockCompositionUpdate.mockResolvedValue({
        id: 'comp-1',
        title: 'Updated Title'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/compositions/comp-1',
        payload: {
          title: 'Updated Title'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.title).toBe('Updated Title')
    })
  })

  describe('DELETE /api/compositions/:id', () => {
    it('should delete a composition', async () => {
      mockCompositionFindUnique.mockResolvedValue({ id: 'comp-1' })
      mockCompositionDelete.mockResolvedValue({ id: 'comp-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/compositions/comp-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should return 404 when composition not found', async () => {
      mockCompositionFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/compositions/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /api/compositions/:id/timeline', () => {
    it('should update timeline with segments', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        segments: []
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/compositions/comp-1/timeline',
        payload: {
          segments: [
            { sceneId: 'scene-1', order: 0, startTime: 0, endTime: 5 }
          ]
        }
      })

      expect(response.statusCode).toBe(200)
      expect(mockSegmentDeleteMany).toHaveBeenCalled()
      expect(mockSegmentCreateMany).toHaveBeenCalled()
    })
  })

  describe('POST /api/compositions/:id/audio', () => {
    it('should reject when no file is uploaded', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/audio',
        payload: {},
        headers: {
          'content-type': 'multipart/form-data'
        }
      })

      // Without multipart support, Fastify returns 415 Unsupported Media Type
      expect([400, 415, 500]).toContain(response.statusCode)
    })
  })

  describe('POST /api/compositions/:id/export', () => {
    it('should return 404 when composition not found', async () => {
      mockCompositionFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/nonexistent/export'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 400 when no segments', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        segments: []
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/export'
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toContain('No segments')
    })

    it('should export successfully with segments', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        segments: [
          { id: 'seg-1', sceneId: 'scene-1', order: 0, startTime: 0, endTime: 5 }
        ]
      })
      mockVideoTaskFindFirst.mockResolvedValue({
        videoUrl: 'https://example.com/video.mp4',
        status: 'completed'
      })
      mockCompositionUpdate.mockResolvedValue({ id: 'comp-1', status: 'exported' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/export'
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return 500 when no selected video for scene', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        segments: [
          { id: 'seg-1', sceneId: 'scene-1', order: 0, startTime: 0, endTime: 5 }
        ]
      })
      mockVideoTaskFindFirst.mockResolvedValue(null) // No selected video

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/export'
      })

      expect(response.statusCode).toBe(500)
    })
  })
})
