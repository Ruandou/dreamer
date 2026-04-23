import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject, getProjectDetail } from '../fixtures/project.fixture.js'
import type { FastifyInstance } from 'fastify'

describe('Projects E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/projects', () => {
    it('should create a project with all fields', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user, {
        name: 'My Test Project',
        description: 'A detailed description',
        aspectRatio: '16:9'
      })

      expect(project.id).toBeDefined()
      expect(project.name).toBe('My Test Project')
      expect(project.description).toBe('A detailed description')
      expect(project.aspectRatio).toBe('16:9')
      expect(project.userId).toBe(user.id)
    })

    it('should create a project with minimal fields', async () => {
      const user = await createTestUser(app)
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { name: 'Minimal Project' }
      })

      expect(response.statusCode).toBe(201)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('Minimal Project')
      expect(data.aspectRatio).toBeNull()
    })

    it('should reject unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'No Auth Project' }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/projects', () => {
    it('should list projects for authenticated user', async () => {
      const user = await createTestUser(app)
      await createTestProject(app, user, { name: 'Project A' })
      await createTestProject(app, user, { name: 'Project B' })

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(2)
      expect(data.some((p: { name: string }) => p.name === 'Project A')).toBe(true)
      expect(data.some((p: { name: string }) => p.name === 'Project B')).toBe(true)
    })

    it('should not list other users projects', async () => {
      const userA = await createTestUser(app)
      const userB = await createTestUser(app)
      await createTestProject(app, userA, { name: 'UserA Project' })

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${userB.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.some((p: { name: string }) => p.name === 'UserA Project')).toBe(false)
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should return project detail', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user, { name: 'Detail Project' })

      const detail = await getProjectDetail(app, user, project.id)

      expect(detail).not.toBeNull()
      expect(detail!.id).toBe(project.id)
      expect(detail!.name).toBe('Detail Project')
    })

    it('should return 404 for non-existent project', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/non-existent-id',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should not allow accessing another users project', async () => {
      const userA = await createTestUser(app)
      const userB = await createTestUser(app)
      const project = await createTestProject(app, userA, { name: 'Private Project' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
        headers: { authorization: `Bearer ${userB.accessToken}` }
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /api/projects/:id', () => {
    it('should update project fields', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user, { name: 'Original Name' })

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${project.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          name: 'Updated Name',
          description: 'Updated description',
          aspectRatio: '4:3'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('Updated Name')
      expect(data.description).toBe('Updated description')
      expect(data.aspectRatio).toBe('4:3')
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user, { name: 'To Delete' })

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(deleteResponse.statusCode).toBe(204)

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(getResponse.statusCode).toBe(404)
    })
  })
})
