import type { FastifyInstance } from 'fastify'
import type { TestUser } from './auth.fixture.js'

export interface TestScene {
  id: string
  episodeId: string
  sceneNum: number
  description: string
  status: string
}

export async function createTestScene(
  app: FastifyInstance,
  user: TestUser,
  episodeId: string,
  overrides: Partial<{ sceneNum: number; description: string; prompt: string }> = {}
): Promise<TestScene> {
  const sceneNum = overrides.sceneNum ?? 1
  const description = overrides.description ?? 'A test scene description'
  const prompt = overrides.prompt ?? 'A cinematic scene with dramatic lighting'

  const response = await app.inject({
    method: 'POST',
    url: '/api/scenes',
    headers: { authorization: `Bearer ${user.accessToken}` },
    payload: { episodeId, sceneNum, description, prompt }
  })

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test scene: ${response.payload}`)
  }

  return JSON.parse(response.payload)
}
