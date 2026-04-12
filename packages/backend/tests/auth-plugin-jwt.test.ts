import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
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

  it('allows request when Bearer token is valid', async () => {
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
