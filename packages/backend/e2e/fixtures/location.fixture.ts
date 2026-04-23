import type { FastifyInstance } from 'fastify'
import type { TestUser } from './auth.fixture.js'

export interface TestLocation {
  id: string
  projectId: string
  name: string
  description: string | null
  timeOfDay: string | null
}

export async function createTestLocation(
  app: FastifyInstance,
  user: TestUser,
  projectId: string,
  overrides: Partial<{ name: string; description: string; timeOfDay: string }> = {}
): Promise<TestLocation> {
  const name = overrides.name ?? `Location ${Date.now()}`
  const description = overrides.description ?? 'A test location'
  const timeOfDay = overrides.timeOfDay ?? 'day'

  const response = await app.inject({
    method: 'POST',
    url: '/api/locations',
    headers: { authorization: `Bearer ${user.accessToken}` },
    payload: { projectId, name, description, timeOfDay }
  })

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test location: ${response.payload}`)
  }

  return JSON.parse(response.payload)
}
