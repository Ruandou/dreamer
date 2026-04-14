import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockCompositionFindMany,
  mockCompositionFindUnique,
  mockCompositionCreate,
  mockCompositionUpdate,
  mockCompositionDelete,
  mockCompositionSceneCreateMany,
  mockCompositionSceneDeleteMany
} = vi.hoisted(() => {
  return {
    mockCompositionFindMany: vi.fn(),
    mockCompositionFindUnique: vi.fn(),
    mockCompositionCreate: vi.fn(),
    mockCompositionUpdate: vi.fn(),
    mockCompositionDelete: vi.fn(),
    mockCompositionSceneCreateMany: vi.fn(),
    mockCompositionSceneDeleteMany: vi.fn()
  }
})

vi.mock('../src/services/ffmpeg.js', () => ({
  composeVideo: vi.fn().mockResolvedValue({
    outputUrl: 'https://storage.example.com/output.mp4',
    duration: 12,
    width: 1080,
    height: 1920
  })
}))

vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://storage.example.com/output.mp4'),
  generateFileKey: vi.fn().mockReturnValue('compositions/output.mp4')
}))

const mockVerifyCompositionOwnership = vi.fn().mockResolvedValue(true)
const mockVerifyProjectOwnership = vi.fn().mockResolvedValue(true)

vi.mock('../src/plugins/auth.js', () => ({
  verifyCompositionOwnership: (...args: any[]) => mockVerifyCompositionOwnership(...args),
  verifyProjectOwnership: (...args: any[]) => mockVerifyProjectOwnership(...args)
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    composition: {
      findMany: mockCompositionFindMany,
      findUnique: mockCompositionFindUnique,
      create: mockCompositionCreate,
      update: mockCompositionUpdate,
      delete: mockCompositionDelete
    },
    compositionScene: {
      createMany: mockCompositionSceneCreateMany,
      deleteMany: mockCompositionSceneDeleteMany
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { compositionRoutes } from '../src/routes/compositions.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Composition Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    app.decorate('authenticate', async (request: any) => {
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
      const mockCompositions = [{ id: 'comp-1', title: 'Composition 1', scenes: [] }]
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
        scenes: [
          {
            id: 'cs-1',
            sceneId: 'scene-1',
            takeId: 'take-1',
            order: 0,
            take: { videoUrl: 'https://storage.example.com/video.mp4', thumbnailUrl: null },
            scene: { id: 'scene-1', sceneNum: 1 }
          }
        ]
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/compositions/comp-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('comp-1')
      expect(data.scenes[0].videoUrl).toBe('https://storage.example.com/video.mp4')
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

      expectPermissionDeniedPayload(response)
    })
  })

  describe('POST /api/compositions', () => {
    it('should create a new composition', async () => {
      const newComposition = {
        id: 'comp-2',
        projectId: 'proj-1',
        episodeId: 'ep-1',
        title: 'New Composition'
      }
      mockCompositionCreate.mockResolvedValue(newComposition)

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions',
        payload: {
          projectId: 'proj-1',
          episodeId: 'ep-1',
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
    it('should update timeline with clips', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        scenes: []
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/compositions/comp-1/timeline',
        payload: {
          clips: [{ sceneId: 'scene-1', takeId: 'take-1', order: 0 }]
        }
      })

      expect(response.statusCode).toBe(200)
      expect(mockCompositionSceneDeleteMany).toHaveBeenCalledWith({ where: { compositionId: 'comp-1' } })
      expect(mockCompositionSceneCreateMany).toHaveBeenCalled()
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

    it('should return 400 when no clips', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        scenes: []
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/export'
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toContain('No clips')
    })

    it('should export successfully with clips', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        scenes: [
          {
            id: 'cs-1',
            sceneId: 'scene-1',
            takeId: 'take-1',
            order: 0,
            take: { videoUrl: 'https://example.com/video.mp4', thumbnailUrl: null }
          }
        ]
      })
      mockCompositionUpdate.mockResolvedValue({ id: 'comp-1', status: 'completed' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/export'
      })

      expect(response.statusCode).toBe(200)
    })

    it('should return 500 when take has no video', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        scenes: [
          {
            id: 'cs-1',
            sceneId: 'scene-1',
            takeId: 'take-1',
            order: 0,
            take: { videoUrl: null, thumbnailUrl: null }
          }
        ]
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/export'
      })

      expect(response.statusCode).toBe(500)
    })

    it('should return 500 when export fails', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        title: 'Composition 1',
        scenes: [
          {
            id: 'cs-1',
            sceneId: 'scene-1',
            takeId: 'take-1',
            order: 0,
            take: { videoUrl: 'https://cdn.example.com/video.mp4', thumbnailUrl: null }
          }
        ]
      })
      const { composeVideo } = await import('../src/services/ffmpeg.js')
      vi.mocked(composeVideo).mockRejectedValueOnce(new Error('FFmpeg error'))

      const response = await app.inject({
        method: 'POST',
        url: '/api/compositions/comp-1/export'
      })

      expect(response.statusCode).toBe(500)
    })
  })
})
