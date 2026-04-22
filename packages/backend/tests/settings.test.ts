import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const { mockUserFindUnique, mockUserUpdate } = vi.hoisted(() => {
  return {
    mockUserFindUnique: vi.fn(),
    mockUserUpdate: vi.fn()
  }
})

// Mock deepseek
vi.mock('../src/services/ai/deepseek.js', () => ({
  getDeepSeekBalance: vi.fn().mockResolvedValue({ balance: 10.5, totalGranted: 10.5 })
}))

// Mock the index.js module
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { settingsRoutes } from '../src/routes/settings.js'

describe('Settings Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    await app.register(settingsRoutes, { prefix: '/api/settings' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/settings/me', () => {
    it('should return user settings', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        apiKey: 'sk-test-key',
        deepseekApiUrl: 'https://api.deepseek.com/v1',
        atlasApiKey: 'atlas-key',
        atlasApiUrl: 'https://atlas.example.com',
        volcAccessKey: 'volc-access',
        volcSecretKey: 'volc-secret',
        volcApiUrl: 'https://volc.example.com',
        createdAt: new Date('2024-01-01')
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/settings/me'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.user.id).toBe('user-1')
      expect(data.user.email).toBe('test@example.com')
      expect(data.hasApiKey).toBe(true)
      expect(data.apiKeys.hasDeepseekApiUrl).toBe(true)
      expect(data.apiKeys.hasAtlasApiKey).toBe(true)
    })

    it('should return user without API key', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        apiKey: null,
        deepseekApiUrl: null,
        atlasApiKey: null,
        atlasApiUrl: null,
        volcAccessKey: null,
        volcSecretKey: null,
        volcApiUrl: null,
        createdAt: new Date('2024-01-01')
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/settings/me'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.hasApiKey).toBe(false)
      expect(data.apiKeys.hasDeepseekApiUrl).toBe(false)
    })
  })

  describe('PUT /api/settings/me', () => {
    it('should update user name', async () => {
      mockUserUpdate.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Updated Name',
        apiKey: null
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/settings/me',
        payload: {
          name: 'Updated Name'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.user.name).toBe('Updated Name')
    })

    it('should update API keys', async () => {
      mockUserUpdate.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        apiKey: 'sk-new-key'
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/settings/me',
        payload: {
          apiKey: 'sk-new-key',
          apiKeys: {
            deepseekApiUrl: 'https://api.deepseek.com/v1',
            atlasApiKey: 'atlas-new-key'
          }
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
    })

    it('should clear API key when empty string provided', async () => {
      mockUserUpdate.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        apiKey: null
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/api/settings/me',
        payload: {
          apiKey: ''
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
    })
  })

  describe('POST /api/settings/verify-api-key', () => {
    it('should verify valid API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/settings/verify-api-key',
        payload: {
          apiKey: 'sk-valid-key'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.valid).toBe(true)
    })

    it('should return 400 when API key is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/settings/verify-api-key',
        payload: {
          apiKey: ''
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
