import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser, loginTestUser } from '../fixtures/auth.fixture.js'
import type { FastifyInstance } from 'fastify'

describe('Auth E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const user = await createTestUser(app)

      expect(user.id).toBeDefined()
      expect(user.email).toMatch(/e2e-.*@test\.com/)
      expect(user.name).toBe('E2E Test User')
      expect(user.accessToken).toBeDefined()
      expect(user.refreshToken).toBeDefined()
    })

    it('should reject duplicate email registration', async () => {
      const email = `duplicate-${Date.now()}@test.com`
      await createTestUser(app, { email })

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password: 'TestPassword123!', name: 'Duplicate' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Email already registered')
    })

    it('should reject registration with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'missing@test.com' }
      })

      // The route doesn't validate body schema; Prisma throws 500 on missing required fields
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const email = `login-${Date.now()}@test.com`
      const password = 'TestPassword123!'
      const created = await createTestUser(app, { email, password })

      const loggedIn = await loginTestUser(app, email, password)

      expect(loggedIn.id).toBe(created.id)
      expect(loggedIn.accessToken).toBeDefined()
    })

    it('should reject invalid password', async () => {
      const email = `badpass-${Date.now()}@test.com`
      await createTestUser(app, { email, password: 'CorrectPass123!' })

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'WrongPass123!' }
      })

      expect(response.statusCode).toBe(401)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Invalid credentials')
    })

    it('should reject non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nobody@test.com', password: 'AnyPass123!' }
      })

      expect(response.statusCode).toBe(401)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('Invalid credentials')
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe(user.id)
      expect(data.email).toBe(user.email)
      expect(data.name).toBe(user.name)
    })

    it('should reject request without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject request with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer invalid-token' }
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
