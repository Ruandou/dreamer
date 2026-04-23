import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject } from '../fixtures/project.fixture.js'
import { createTestEpisode, getEpisodeDetail } from '../fixtures/episode.fixture.js'
import type { FastifyInstance } from 'fastify'

describe('Episodes E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/episodes', () => {
    it('should create an episode for a project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id, {
        episodeNum: 1,
        title: 'Pilot Episode'
      })

      expect(episode.id).toBeDefined()
      expect(episode.projectId).toBe(project.id)
      expect(episode.episodeNum).toBe(1)
      expect(episode.title).toBe('Pilot Episode')
    })

    it('should reject episode creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes',
        payload: { projectId: 'any-id', episodeNum: 1 }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject episode creation for non-owned project', async () => {
      const userA = await createTestUser(app)
      const userB = await createTestUser(app)
      const project = await createTestProject(app, userA)

      const response = await app.inject({
        method: 'POST',
        url: '/api/episodes',
        headers: { authorization: `Bearer ${userB.accessToken}` },
        payload: { projectId: project.id, episodeNum: 1 }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/episodes', () => {
    it('should list episodes for a project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      await createTestEpisode(app, user, project.id, { episodeNum: 1, title: 'Ep 1' })
      await createTestEpisode(app, user, project.id, { episodeNum: 2, title: 'Ep 2' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/episodes?projectId=${project.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
    })
  })

  describe('GET /api/episodes/:id', () => {
    it('should return episode detail', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id, {
        episodeNum: 1,
        title: 'Detail Test'
      })

      const detail = await getEpisodeDetail(app, user, episode.id)

      expect(detail).not.toBeNull()
      expect(detail!.id).toBe(episode.id)
      expect(detail!.title).toBe('Detail Test')
    })

    it('should return 404/403 for non-existent episode', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/episodes/non-existent-id',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      // Ownership check may return 403 before find returns 404
      expect([404, 403]).toContain(response.statusCode)
    })
  })

  describe('PUT /api/episodes/:id', () => {
    it('should update episode fields', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id, {
        episodeNum: 1,
        title: 'Original'
      })

      const response = await app.inject({
        method: 'PUT',
        url: `/api/episodes/${episode.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          title: 'Updated Title',
          synopsis: 'Updated synopsis'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.title).toBe('Updated Title')
      expect(data.synopsis).toBe('Updated synopsis')
    })
  })

  describe('DELETE /api/episodes/:id', () => {
    it('should delete an episode', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id, {
        episodeNum: 1,
        title: 'To Delete'
      })

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/episodes/${episode.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(deleteResponse.statusCode).toBe(204)

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/episodes/${episode.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      // After deletion, ownership check may return 403 before 404
      expect([404, 403]).toContain(getResponse.statusCode)
    })
  })

  describe('GET /api/episodes/:id/detail', () => {
    it('should return episode with scenes tree', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const episode = await createTestEpisode(app, user, project.id, {
        episodeNum: 1,
        title: 'With Scenes'
      })

      const response = await app.inject({
        method: 'GET',
        url: `/api/episodes/${episode.id}/detail`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.episode).toBeDefined()
      expect(data.episode.id).toBe(episode.id)
      expect(Array.isArray(data.scenes)).toBe(true)
    })
  })
})
