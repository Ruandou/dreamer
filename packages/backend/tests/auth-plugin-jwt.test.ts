import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'

const { mockUserFindUnique } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn()
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique
    }
  }
}))

import { authPlugin } from '../src/plugins/auth.js'

describe('authPlugin (JWT authenticate)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(jwt, { secret: 'test-secret-auth-plugin-jwt-only' })
    await app.register(authPlugin)
    app.get('/protected', { preHandler: [app.authenticate] }, async () => ({ ok: true }))
    await app.ready()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 401 without Authorization header', async () => {
    const response = await app.inject({ method: 'GET', url: '/protected' })

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.payload)).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when Bearer token is invalid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer not-a-valid-jwt' }
    })

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.payload)).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when JWT is valid but user no longer exists', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    const token = app.jwt.sign({ id: 'ghost-user', email: 'gone@example.com' })
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` }
    })

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.payload)).toEqual({
      error: 'Unauthorized',
      message: '登录已失效，请重新登录'
    })
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'ghost-user' },
      select: { id: true, email: true, name: true }
    })
  })

  it('allows request when Bearer token is valid and user exists', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'u@example.com',
      name: 'U'
    })
    const token = app.jwt.sign({ id: 'user-1', email: 'u@example.com' })
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` }
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual({ ok: true })
  })
})
