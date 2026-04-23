import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject } from '../fixtures/project.fixture.js'
import { createTestEpisode } from '../fixtures/episode.fixture.js'
import { createTestScene } from '../fixtures/scene.fixture.js'
import type { FastifyInstance } from 'fastify'

// Mock video queue to avoid BullMQ dependency
vi.mock('../../src/queues/video.js', () => ({
  videoQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-video-job-id' })
  }
}))

describe('Scenes E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/scenes', () => {
    it('should create a scene for an episode', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id)
      const scene = await createTestScene(app, user, episode.id, {
        sceneNum: 1,
        description: 'Opening scene',
        prompt: 'A wide shot of a city skyline at dawn'
      })

      expect(scene.id).toBeDefined()
      expect(scene.episodeId).toBe(episode.id)
      expect(scene.sceneNum).toBe(1)
      expect(scene.description).toBe('Opening scene')
    })

    it('should reject scene creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes',
        payload: { episodeId: 'any-id', sceneNum: 1, prompt: 'test' }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject scene creation for non-owned episode', async () => {
      const userA = await createTestUser(app)
      const userB = await createTestUser(app)
      const project = await createTestProject(app, userA)
      const episode = await createTestEpisode(app, userA, project.id)

      const response = await app.inject({
        method: 'POST',
        url: '/api/scenes',
        headers: { authorization: `Bearer ${userB.accessToken}` },
        payload: { episodeId: episode.id, sceneNum: 1, prompt: 'test' }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/scenes', () => {
    it('should list scenes for an episode', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id)
      await createTestScene(app, user, episode.id, { sceneNum: 1, description: 'Scene 1' })
      await createTestScene(app, user, episode.id, { sceneNum: 2, description: 'Scene 2' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/scenes?episodeId=${episode.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
    })
  })

  describe('GET /api/scenes/:id', () => {
    it('should return scene with takes and shots', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id)
      const scene = await createTestScene(app, user, episode.id, { sceneNum: 1 })

      const response = await app.inject({
        method: 'GET',
        url: `/api/scenes/${scene.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe(scene.id)
      expect(Array.isArray(data.takes)).toBe(true)
      expect(Array.isArray(data.shots)).toBe(true)
    })

    it('should return 404/403 for non-existent scene', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/scenes/non-existent-id',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      // Ownership check may return 403 before find returns 404
      expect([404, 403]).toContain(response.statusCode)
    })
  })

  describe('PUT /api/scenes/:id', () => {
    it('should update scene fields', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id)
      const scene = await createTestScene(app, user, episode.id, {
        sceneNum: 1,
        description: 'Original'
      })

      const response = await app.inject({
        method: 'PUT',
        url: `/api/scenes/${scene.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { description: 'Updated description', sceneNum: 2 }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.description).toBe('Updated description')
      expect(data.sceneNum).toBe(2)
    })
  })

  describe('DELETE /api/scenes/:id', () => {
    it('should delete a scene', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id)
      const scene = await createTestScene(app, user, episode.id, { sceneNum: 1 })

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/scenes/${scene.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(deleteResponse.statusCode).toBe(204)

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/scenes/${scene.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      // After deletion, ownership check may return 403 before 404
      expect([404, 403]).toContain(getResponse.statusCode)
    })
  })

  describe('POST /api/scenes/:id/generate', () => {
    it('should enqueue video generation for a scene', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id)
      const scene = await createTestScene(app, user, episode.id, {
        sceneNum: 1,
        prompt: 'A cinematic scene'
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/scenes/${scene.id}/generate`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { model: 'wan-2.1-t2v-720p' }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.taskId).toBeDefined()
      expect(data.sceneId).toBe(scene.id)
    })
  })
})
