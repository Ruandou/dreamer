import type { FastifyInstance } from 'fastify'
import type { TestUser } from './auth.fixture.js'

export interface TestEpisode {
  id: string
  projectId: string
  episodeNum: number
  title: string | null
  synopsis: string | null
}

export async function createTestEpisode(
  app: FastifyInstance,
  user: TestUser,
  projectId: string,
  overrides: Partial<{ episodeNum: number; title: string }> = {}
): Promise<TestEpisode> {
  const episodeNum = overrides.episodeNum ?? 1
  const title = overrides.title ?? `Episode ${episodeNum}`

  const response = await app.inject({
    method: 'POST',
    url: '/api/episodes',
    headers: { authorization: `Bearer ${user.accessToken}` },
    payload: { projectId, episodeNum, title }
  })

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test episode: ${response.payload}`)
  }

  return JSON.parse(response.payload)
}

export async function getEpisodeDetail(
  app: FastifyInstance,
  user: TestUser,
  episodeId: string
): Promise<TestEpisode | null> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/episodes/${episodeId}`,
    headers: { authorization: `Bearer ${user.accessToken}` }
  })

  if (response.statusCode === 404) {
    return null
  }

  if (response.statusCode !== 200) {
    throw new Error(`Failed to get episode detail: ${response.payload}`)
  }

  return JSON.parse(response.payload)
}
