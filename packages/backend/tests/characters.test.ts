import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module evaluation
const { mockPrisma, mockCharacterFindMany, mockCharacterFindUnique, mockCharacterCreate, mockCharacterUpdate, mockCharacterDelete } = vi.hoisted(() => {
  const findMany = vi.fn()
  const findUnique = vi.fn()
  const create = vi.fn()
  const update = vi.fn()
  const deleteFn = vi.fn()
  const deleteMany = vi.fn()
  const projectFindUnique = vi.fn()

  const prisma = {
    character: {
      findMany,
      findUnique,
      create,
      update,
      delete: deleteFn,
      deleteMany
    },
    project: {
      findUnique: projectFindUnique
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }

  return {
    mockPrisma: prisma,
    mockCharacterFindMany: findMany,
    mockCharacterFindUnique: findUnique,
    mockCharacterCreate: create,
    mockCharacterUpdate: update,
    mockCharacterDelete: deleteFn,
    mockProjectFindUnique: projectFindUnique
  }
})

// Set up mocks before importing
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma)
}))

vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://storage.example.com/test.jpg'),
  generateFileKey: vi.fn().mockReturnValue('test/key.jpg')
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifyCharacterOwnership: vi.fn().mockResolvedValue(true),
  verifyProjectOwnership: vi.fn().mockResolvedValue(true)
}))

// Import routes after mocks are set up
import { characterRoutes } from '../src/routes/characters.js'

describe('Character Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id' }
    })

    await app.register(characterRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /characters', () => {
    it('should return characters for a project', async () => {
      const mockCharacters = [
        { id: '1', name: 'Character 1', projectId: 'proj-1', images: [] }
      ]
      mockCharacterFindMany.mockResolvedValue(mockCharacters)

      const response = await app.inject({
        method: 'GET',
        url: '/characters?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(1)
    })

    it('should return empty array when no characters exist', async () => {
      mockCharacterFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/characters?projectId=proj-1'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    })
  })

  describe('POST /characters', () => {
    it('should create a new character', async () => {
      const newCharacter = {
        id: '2',
        name: 'New Character',
        description: 'Test',
        projectId: 'proj-1'
      }
      mockCharacterCreate.mockResolvedValue(newCharacter)

      const response = await app.inject({
        method: 'POST',
        url: '/characters',
        payload: {
          projectId: 'proj-1',
          name: 'New Character',
          description: 'Test'
        }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('New Character')
    })
  })

  describe('PUT /characters/:id', () => {
    it('should update a character', async () => {
      const updatedCharacter = {
        id: '1',
        name: 'Updated Name',
        description: 'Updated'
      }
      mockCharacterUpdate.mockResolvedValue(updatedCharacter)

      const response = await app.inject({
        method: 'PUT',
        url: '/characters/1',
        payload: {
          name: 'Updated Name'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('Updated Name')
    })
  })

  describe('DELETE /characters/:id', () => {
    it('should delete a character', async () => {
      // verifyProjectOwnership needs projectFindUnique to return a project
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', userId: 'test-user-id' })
      // verifyCharacterOwnership needs character findUnique
      mockCharacterFindUnique.mockResolvedValue({ id: '1', name: 'To Delete', projectId: 'proj-1' })
      mockCharacterDelete.mockResolvedValue({ id: '1' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/characters/1'
      })

      expect(response.statusCode).toBe(204)
    })

    it('should return 404 when character not found', async () => {
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', userId: 'test-user-id' })
      mockCharacterFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'DELETE',
        url: '/characters/999'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
