import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const { mockUserFindUnique, mockUserCreate } = vi.hoisted(() => {
  return {
    mockUserFindUnique: vi.fn(),
    mockUserCreate: vi.fn()
  }
})

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn()
  }
}))

// Mock the index.js module
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import routes after all mocks are set up
import { authRoutes } from '../src/routes/auth.js'

describe('Auth Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Add authenticate decorator before registering routes
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    })

    app.decorate('jwt', {
      sign: vi.fn().mockReturnValue('mocked.jwt.token')
    })

    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        id: 'user-1',
        email: 'new@example.com',
        name: 'New User',
        password: 'hashed_password',
        createdAt: new Date()
      }
      mockUserFindUnique.mockResolvedValue(null) // No existing user
      mockUserCreate.mockResolvedValue(newUser)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'new@example.com',
          password: 'password123',
          name: 'New User'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.accessToken).toBeDefined()
      expect(data.user.email).toBe('new@example.com')
    })

    it('should return 400 when email already exists', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'existing', email: 'existing@example.com' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'existing@example.com',
          password: 'password123',
          name: 'Existing User'
        }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Email already registered')
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const bcrypt = await import('bcrypt')
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password'
      })
      ;(bcrypt.default.compare as any).mockResolvedValue(true)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.accessToken).toBeDefined()
      expect(data.user.email).toBe('test@example.com')
    })

    it('should return 401 when user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123'
        }
      })

      expect(response.statusCode).toBe(401)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Invalid credentials')
    })

    it('should return 401 when password is incorrect', async () => {
      const bcrypt = await import('bcrypt')
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password'
      })
      ;(bcrypt.default.compare as any).mockResolvedValue(false)

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      })

      expect(response.statusCode).toBe(401)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Invalid credentials')
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date()
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.email).toBe('test@example.com')
      expect(data.name).toBe('Test User')
    })
  })
})
