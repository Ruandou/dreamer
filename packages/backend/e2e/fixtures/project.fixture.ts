import type { FastifyInstance } from 'fastify'
import type { TestUser } from './auth.fixture.js'

export interface TestProject {
  id: string
  name: string
  description: string | null
  aspectRatio: string | null
  userId: string
}

export async function createTestProject(
  app: FastifyInstance,
  user: TestUser,
  overrides: Partial<{ name: string; description: string; aspectRatio: string }> = {}
): Promise<TestProject> {
  const name = overrides.name ?? `E2E Project ${Date.now()}`
  const description = overrides.description ?? 'A test project created during e2e testing'
  const aspectRatio = overrides.aspectRatio ?? '9:16'

  const response = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { authorization: `Bearer ${user.accessToken}` },
    payload: { name, description, aspectRatio }
  })

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test project: ${response.payload}`)
  }

  const data = JSON.parse(response.payload)
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    aspectRatio: data.aspectRatio,
    userId: data.userId
  }
}

export async function getProjectDetail(
  app: FastifyInstance,
  user: TestUser,
  projectId: string
): Promise<TestProject | null> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/projects/${projectId}`,
    headers: { authorization: `Bearer ${user.accessToken}` }
  })

  if (response.statusCode === 404) {
    return null
  }

  if (response.statusCode !== 200) {
    throw new Error(`Failed to get project detail: ${response.payload}`)
  }

  return JSON.parse(response.payload)
}
