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
  mockCharacterImageCount,
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
    mockCharacterImageCount: vi.fn(),
    mockProjectFindFirst: vi.fn()
  }
})

const { mockGenerateCharacterSlotImagePrompt } = vi.hoisted(() => ({
  mockGenerateCharacterSlotImagePrompt: vi.fn().mockResolvedValue({
    prompt: '中文定妆提示词用于测试',
    cost: { costCNY: 0.01, inputTokens: 10, outputTokens: 20 }
  })
}))

vi.mock('../src/services/ai/deepseek.js', () => ({
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
vi.mock('../src/lib/prisma.js', () => ({
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
      aggregate: mockCharacterImageAggregate,
      count: mockCharacterImageCount
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
    mockCharacterImageCount.mockResolvedValue(0)
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
        prompt: '中文定妆提示词用于测试',
        avatarUrl: null,
        order: 1
      })
      mockCharacterFindMany.mockResolvedValue([
        {
          id: 'char-1',
          name: '主角',
          projectId: 'proj-1',
          images: [{ id: 'img-new', name: '夜礼服', type: 'outfit', prompt: '中文定妆提示词用于测试' }]
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
      expect(createArg.data.prompt).toBe('中文定妆提示词用于测试')
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

    it('should return 409 when second root base slot is requested (JSON)', async () => {
      mockCharacterImageCount.mockResolvedValue(1)
      mockCharacterFindUnique.mockResolvedValue({
        id: 'char-1',
        name: '主角',
        description: '',
        projectId: 'proj-1'
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/characters/char-1/images',
        headers: { 'content-type': 'application/json' },
        payload: { name: '第二套基础', type: 'base' }
      })

      expect(response.statusCode).toBe(409)
      expect(mockGenerateCharacterSlotImagePrompt).not.toHaveBeenCalled()
      expect(mockCharacterImageCreate).not.toHaveBeenCalled()
    })

    it('should return 201 when creating first root base slot (JSON)', async () => {
      mockCharacterImageCount.mockResolvedValue(0)
      mockCharacterFindUnique.mockResolvedValue({
        id: 'char-1',
        name: '主角',
        description: '',
        projectId: 'proj-1'
      })
      mockCharacterImageAggregate.mockResolvedValue({ _max: { order: 0 } })
      mockCharacterImageCreate.mockResolvedValue({
        id: 'img-base',
        characterId: 'char-1',
        name: '主定妆',
        type: 'base',
        prompt: 'p',
        avatarUrl: null,
        order: 0
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/characters/char-1/images',
        headers: { 'content-type': 'application/json' },
        payload: { name: '主定妆', type: 'base' }
      })

      expect(response.statusCode).toBe(201)
      expect(mockGenerateCharacterSlotImagePrompt).toHaveBeenCalled()
      expect(mockCharacterImageCreate).toHaveBeenCalled()
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
      mockCharacterImageFindUnique.mockResolvedValue({
        id: 'img-1',
        characterId: 'char-1',
        type: 'outfit',
        parentId: 'base-1'
      })
      mockCharacterImageFindMany.mockResolvedValue([]) // No children
      mockCharacterImageDelete.mockResolvedValue({ id: 'img-1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/characters/char-1/images/img-1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should delete image with children', async () => {
      mockCharacterImageFindUnique.mockResolvedValue({
        id: 'img-1',
        characterId: 'char-1',
        type: 'outfit',
        parentId: 'base-1'
      })
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

    it('should return 400 when deleting root base image', async () => {
      mockCharacterImageFindUnique.mockResolvedValue({
        id: 'img-base',
        characterId: 'char-1',
        type: 'base',
        parentId: null
      })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/characters/char-1/images/img-base'
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error).toContain('基础形象')
      expect(mockCharacterImageDelete).not.toHaveBeenCalled()
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
