import type { FastifyInstance } from 'fastify'
import type { TestUser } from './auth.fixture.js'

export interface TestCharacter {
  id: string
  projectId: string
  name: string
  description: string | null
}

export async function createTestCharacter(
  app: FastifyInstance,
  user: TestUser,
  projectId: string,
  overrides: Partial<{ name: string; description: string }> = {}
): Promise<TestCharacter> {
  const name = overrides.name ?? `Character ${Date.now()}`
  const description = overrides.description ?? 'A test character'

  const response = await app.inject({
    method: 'POST',
    url: '/api/characters',
    headers: { authorization: `Bearer ${user.accessToken}` },
    payload: { projectId, name, description }
  })

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test character: ${response.payload}`)
  }

  return JSON.parse(response.payload)
}
