import type { FastifyInstance } from 'fastify'

export interface TestUser {
  id: string
  email: string
  name: string
  password: string
  accessToken: string
  refreshToken: string
}

export async function createTestUser(
  app: FastifyInstance,
  overrides: Partial<{ email: string; name: string; password: string }> = {}
): Promise<TestUser> {
  const password = overrides.password ?? 'TestPassword123!'
  const email =
    overrides.email ?? `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`
  const name = overrides.name ?? 'E2E Test User'

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, name }
  })

  if (response.statusCode !== 200) {
    throw new Error(`Failed to create test user: ${response.payload}`)
  }

  const data = JSON.parse(response.payload)
  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    password,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  }
}

export async function loginTestUser(
  app: FastifyInstance,
  email: string,
  password: string
): Promise<TestUser> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password }
  })

  if (response.statusCode !== 200) {
    throw new Error(`Failed to login test user: ${response.payload}`)
  }

  const data = JSON.parse(response.payload)
  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    password,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  }
}
