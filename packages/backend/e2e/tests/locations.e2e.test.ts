import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject } from '../fixtures/project.fixture.js'
import { createTestLocation } from '../fixtures/location.fixture.js'
import type { FastifyInstance } from 'fastify'

describe('Locations E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/locations', () => {
    it('should create a location for a project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const location = await createTestLocation(app, user, project.id, {
        name: 'City Park',
        description: 'A beautiful park in the city',
        timeOfDay: 'morning'
      })

      expect(location.id).toBeDefined()
      expect(location.projectId).toBe(project.id)
      expect(location.name).toBe('City Park')
      expect(location.description).toBe('A beautiful park in the city')
      expect(location.timeOfDay).toBe('morning')
    })

    it('should reject location creation without projectId', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/locations',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { name: 'Orphan Location' }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject location creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/locations',
        payload: { projectId: 'any-id', name: 'No Auth' }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/locations', () => {
    it('should list locations for a project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      await createTestLocation(app, user, project.id, { name: 'Beach' })
      await createTestLocation(app, user, project.id, { name: 'Mountain' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/locations?projectId=${project.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data.some((l: { name: string }) => l.name === 'Beach')).toBe(true)
      expect(data.some((l: { name: string }) => l.name === 'Mountain')).toBe(true)
    })
  })

  describe('PUT /api/locations/:id', () => {
    it('should update location fields', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const location = await createTestLocation(app, user, project.id, {
        name: 'Old Name',
        description: 'Old desc',
        timeOfDay: 'day'
      })

      const response = await app.inject({
        method: 'PUT',
        url: `/api/locations/${location.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          description: 'New desc',
          timeOfDay: 'night',
          characters: ['Alice', 'Bob']
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.description).toBe('New desc')
      expect(data.timeOfDay).toBe('night')
      expect(data.characters).toEqual(['Alice', 'Bob'])
    })
  })

  describe('DELETE /api/locations/:id', () => {
    it('should delete a location', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const location = await createTestLocation(app, user, project.id, { name: 'To Delete' })

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/locations/${location.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(deleteResponse.statusCode).toBe(204)

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/locations?projectId=${project.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      const data = JSON.parse(getResponse.payload)
      expect(data.some((l: { id: string }) => l.id === location.id)).toBe(false)
    })
  })
})
