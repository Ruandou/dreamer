import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject } from '../fixtures/project.fixture.js'
import { createTestEpisode } from '../fixtures/episode.fixture.js'
import { createTestScene } from '../fixtures/scene.fixture.js'
import type { FastifyInstance } from 'fastify'

// Mock video queue
vi.mock('../../src/queues/video.js', () => ({
  videoQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-video-job-id' })
  }
}))

describe('Tasks Unified E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/tasks/all', () => {
    it('should return empty jobs list for new user', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/all',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.jobs).toBeInstanceOf(Array)
      expect(data.total).toBe(0)
      expect(data.limit).toBeDefined()
      expect(data.offset).toBeDefined()
    })

    it('should include video tasks after generation', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id)
      const scene = await createTestScene(app, user, episode.id, {
        sceneNum: 1,
        prompt: 'Test scene for video generation'
      })

      // Enqueue a video generation
      await app.inject({
        method: 'POST',
        url: `/api/scenes/${scene.id}/generate`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { model: 'wan-2.1-t2v-720p' }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/all',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.jobs.length).toBeGreaterThanOrEqual(1)
      expect(data.jobs.some((j: { type: string }) => j.type === 'video')).toBe(true)
    })

    it('should filter by type', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/all?type=video',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.jobs.every((j: { type: string }) => j.type === 'video')).toBe(true)
    })

    it('should paginate results', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/all?limit=5&offset=0',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.limit).toBe(5)
      expect(data.offset).toBe(0)
      expect(data.jobs.length).toBeLessThanOrEqual(5)
    })

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tasks/all'
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
