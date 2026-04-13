import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockCharacterFindMany,
  mockCharacterFindUnique,
  mockCharacterCreate,
  mockCharacterUpdate,
  mockCharacterDelete,
  mockCharacterImageFindMany,
  mockCharacterImageFindFirst,
  mockCharacterImageFindUnique,
  mockCharacterImageUpdate,
  mockCharacterImageDelete,
  mockCharacterImageCreate,
  mockCharacterImageAggregate,
  mockProjectFindFirst
} = vi.hoisted(() => {
  return {
    mockCharacterFindMany: vi.fn(),
    mockCharacterFindUnique: vi.fn(),
    mockCharacterCreate: vi.fn(),
    mockCharacterUpdate: vi.fn(),
    mockCharacterDelete: vi.fn(),
    mockCharacterImageFindMany: vi.fn(),
    mockCharacterImageFindFirst: vi.fn(),
    mockCharacterImageFindUnique: vi.fn(),
    mockCharacterImageUpdate: vi.fn(),
    mockCharacterImageDelete: vi.fn(),
    mockCharacterImageCreate: vi.fn(),
    mockCharacterImageAggregate: vi.fn(),
    mockProjectFindFirst: vi.fn()
  }
})

const { mockGenerateCharacterSlotImagePrompt } = vi.hoisted(() => ({
  mockGenerateCharacterSlotImagePrompt: vi.fn().mockResolvedValue({
    prompt: 'English portrait prompt for test',
    cost: { costCNY: 0.01, inputTokens: 10, outputTokens: 20 }
  })
}))

vi.mock('../src/services/deepseek.js', () => ({
  generateCharacterSlotImagePrompt: (...args: unknown[]) => mockGenerateCharacterSlotImagePrompt(...args)
}))

// Mock storage service
vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://storage.example.com/image.png'),
  generateFileKey: vi.fn().mockReturnValue('assets/image.png')
}))

// Mock verifyCharacterOwnership and verifyProjectOwnership
const mockVerifyCharacterOwnership = vi.fn().mockResolvedValue(true)
const mockVerifyProjectOwnership = vi.fn().mockResolvedValue(true)

vi.mock('../src/plugins/auth.js', () => ({
  verifyCharacterOwnership: (...args: any[]) => mockVerifyCharacterOwnership(...args),
  verifyProjectOwnership: (...args: any[]) => mockVerifyProjectOwnership(...args)
}))

// Mock the index.js module
vi.mock('../src/index.js', () => ({
  prisma: {
    character: {
      findMany: mockCharacterFindMany,
      findUnique: mockCharacterFindUnique,
      create: mockCharacterCreate,
      update: mockCharacterUpdate,
      delete: mockCharacterDelete
    },
    characterImage: {
      findMany: mockCharacterImageFindMany,
      findFirst: mockCharacterImageFindFirst,
      findUnique: mockCharacterImageFindUnique,
      update: mockCharacterImageUpdate,
      delete: mockCharacterImageDelete,
      create: mockCharacterImageCreate,
      aggregate: mockCharacterImageAggregate
    },
    project: {
      findFirst: mockProjectFindFirst
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { characterRoutes } from '../src/routes/characters.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Character Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(characterRoutes, { prefix: '/api/characters' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/characters', () => {
    it('should return characters for a project', async () => {
      const mockCharacters = [
        { id: 'char-1', name: 'Character 1', description: 'Test', images: [] }
      ]
      mockCharacterFindMany.mockResolvedValue(mockCharacters)

      const response = await app.inject({
        method: 'GET',
        url: '/api/characters?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(1)
    })
  })

  describe('GET /api/characters/:id', () => {
    it('should return character details', async () => {
      mockCharacterFindUnique.mockResolvedValue({
        id: 'char-1',
        name: 'Character 1',
        description: 'Test character',
        images: []
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/characters/char-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('char-1')
    })

    it('should return 404 when character not found', async () => {
      mockCharacterFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/characters/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 when user does not own character', async () => {
      mockVerifyCharacterOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'GET',
        url: '/api/characters/char-1'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('POST /api/characters', () => {
    it('should create a new character', async () => {
      const newCharacter = {
        id: 'char-2',
        projectId: 'proj-1',
        name: 'New Character',
        description: 'A new character'
      }
      mockCharacterCreate.mockResolvedValue(newCharacter)

      const response = await app.inject({
        method: 'POST',
        url: '/api/characters',
        payload: {
          projectId: 'proj-1',
          name: 'New Character',
          description: 'A new character'
        }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('char-2')
    })
  })

  describe('PUT /api/characters/:id', () => {
    it('should update a character', async () => {
      mockCharacterUpdate.mockResolvedValue({
        id: 'char-1',
        name: 'Updated Character',
        description: 'Updated description'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/characters/char-1',
        payload: {
          name: 'Updated Character',
          description: 'Updated description'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('Updated Character')
    })
  })

  describe('DELETE /api/characters/:id', () => {
    it('should delete a character', async () => {
      mockCharacterDelete.mockResolvedValue({ id: 'char-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/characters/char-1'
      })

      expect(response.statusCode).toBe(204)
    })
  })

  describe('POST /api/characters/:id/images (JSON, AI 建槽)', () => {
    it('should create image slot with DeepSeek prompt when not multipart', async () => {
      mockCharacterImageFindFirst.mockResolvedValue({ id: 'base-1', characterId: 'char-1' })
      mockCharacterFindUnique.mockResolvedValue({
        id: 'char-1',
        name: '主角',
        description: '年轻侦探',
        projectId: 'proj-1'
      })
      mockCharacterImageAggregate.mockResolvedValue({ _max: { order: 0 } })
      mockCharacterImageCreate.mockResolvedValue({
        id: 'img-new',
        characterId: 'char-1',
        name: '夜礼服',
        type: 'outfit',
        prompt: 'English portrait prompt for test',
        avatarUrl: null,
        order: 1
      })
      mockCharacterFindMany.mockResolvedValue([
        {
          id: 'char-1',
          name: '主角',
          projectId: 'proj-1',
          images: [{ id: 'img-new', name: '夜礼服', type: 'outfit', prompt: 'English portrait prompt for test' }]
        }
      ])

      const response = await app.inject({
        method: 'POST',
        url: '/api/characters/char-1/images',
        headers: { 'content-type': 'application/json' },
        payload: {
          name: '夜礼服',
          type: 'outfit',
          parentId: 'base-1',
          description: '宴会造型'
        }
      })

      expect(response.statusCode).toBe(201)
      expect(mockGenerateCharacterSlotImagePrompt).toHaveBeenCalled()
      expect(mockCharacterImageCreate).toHaveBeenCalled()
      const createArg = mockCharacterImageCreate.mock.calls[0][0]
      expect(createArg.data.prompt).toBe('English portrait prompt for test')
      expect(createArg.data.avatarUrl).toBeNull()
    })

    it('should return 400 when JSON body missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/characters/char-1/images',
        headers: { 'content-type': 'application/json' },
        payload: { type: 'base' }
      })
      expect(response.statusCode).toBe(400)
    })

    it('should return 400 when parentId invalid for JSON path', async () => {
      mockCharacterImageFindFirst.mockResolvedValue(null)
      const response = await app.inject({
        method: 'POST',
        url: '/api/characters/char-1/images',
        headers: { 'content-type': 'application/json' },
        payload: { name: 'x', parentId: 'bad-parent' }
      })
      expect(response.statusCode).toBe(400)
    })
  })

  describe('PUT /api/characters/:id/images/:imageId', () => {
    it('should update character image', async () => {
      mockCharacterImageUpdate.mockResolvedValue({
        id: 'img-1',
        name: 'Updated Image',
        type: 'pose'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/characters/char-1/images/img-1',
        payload: {
          name: 'Updated Image',
          type: 'pose'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('Updated Image')
    })

    it('should persist prompt when provided', async () => {
      mockCharacterImageUpdate.mockResolvedValue({
        id: 'img-1',
        name: 'X',
        prompt: 'a cinematic portrait'
      })
      const response = await app.inject({
        method: 'PUT',
        url: '/api/characters/char-1/images/img-1',
        payload: { prompt: 'a cinematic portrait' }
      })
      expect(response.statusCode).toBe(200)
      expect(mockCharacterImageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ prompt: 'a cinematic portrait' })
        })
      )
    })
  })

  describe('DELETE /api/characters/:id/images/:imageId', () => {
    it('should delete character image', async () => {
      mockCharacterImageFindMany.mockResolvedValue([]) // No children
      mockCharacterImageDelete.mockResolvedValue({ id: 'img-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/characters/char-1/images/img-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should delete image with children', async () => {
      mockCharacterImageFindMany.mockResolvedValueOnce([
        { id: 'child-1', parentId: 'img-1' }
      ])
      mockCharacterImageFindMany.mockResolvedValueOnce([]) // Child has no children
      mockCharacterImageDelete.mockResolvedValue({ id: 'child-1' })
      mockCharacterImageDelete.mockResolvedValue({ id: 'img-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/characters/char-1/images/img-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should return 403 when user does not own character', async () => {
      mockVerifyCharacterOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/characters/char-1/images/img-1'
      })

      expectPermissionDeniedPayload(response)
    })
  })

  describe('PUT /api/characters/:id/images/:imageId/move', () => {
    it('should move image to new parent', async () => {
      mockCharacterImageAggregate.mockResolvedValue({ _max: { order: 1 } })
      mockCharacterImageUpdate.mockResolvedValue({
        id: 'img-1',
        parentId: 'new-parent'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/characters/char-1/images/img-1/move',
        payload: {
          parentId: 'new-parent'
        }
      })

      expect(response.statusCode).toBe(200)
    })

    it('should reject circular reference', async () => {
      // Setup mock to detect circular reference
      mockCharacterImageFindUnique.mockResolvedValueOnce({
        id: 'parent',
        parentId: 'img-1'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/characters/char-1/images/img-1/move',
        payload: {
          parentId: 'parent'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 403 when user does not own character', async () => {
      mockVerifyCharacterOwnership.mockResolvedValueOnce(false)

      const response = await app.inject({
        method: 'PUT',
        url: '/api/characters/char-1/images/img-1/move',
        payload: {
          parentId: 'new-parent'
        }
      })

      expectPermissionDeniedPayload(response)
    })
  })
})
