import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject } from '../fixtures/project.fixture.js'
import { createTestCharacter } from '../fixtures/character.fixture.js'
import type { FastifyInstance } from 'fastify'

describe('Characters E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/characters', () => {
    it('should create a character for a project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const character = await createTestCharacter(app, user, project.id, {
        name: 'Hero',
        description: 'The main protagonist'
      })

      expect(character.id).toBeDefined()
      expect(character.projectId).toBe(project.id)
      expect(character.name).toBe('Hero')
      expect(character.description).toBe('The main protagonist')
    })

    it('should reject character creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/characters',
        payload: { projectId: 'any-id', name: 'No Auth' }
      })

      expect(response.statusCode).toBe(401)
    })

    it('should reject character creation for non-owned project', async () => {
      const userA = await createTestUser(app)
      const userB = await createTestUser(app)
      const project = await createTestProject(app, userA)

      const response = await app.inject({
        method: 'POST',
        url: '/api/characters',
        headers: { authorization: `Bearer ${userB.accessToken}` },
        payload: { projectId: project.id, name: 'Intruder' }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/characters', () => {
    it('should list characters for a project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      await createTestCharacter(app, user, project.id, { name: 'Alice' })
      await createTestCharacter(app, user, project.id, { name: 'Bob' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/characters?projectId=${project.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data.some((c: { name: string }) => c.name === 'Alice')).toBe(true)
      expect(data.some((c: { name: string }) => c.name === 'Bob')).toBe(true)
    })
  })

  describe('GET /api/characters/:id', () => {
    it('should return character with images', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const character = await createTestCharacter(app, user, project.id, { name: 'Detail Char' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/characters/${character.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe(character.id)
      expect(data.name).toBe('Detail Char')
      expect(Array.isArray(data.images)).toBe(true)
    })

    it('should return 404/403 for non-existent character', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/characters/non-existent-id',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      // Ownership check may return 403 before find returns 404
      expect([404, 403]).toContain(response.statusCode)
    })
  })

  describe('PUT /api/characters/:id', () => {
    it('should update character fields', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const character = await createTestCharacter(app, user, project.id, {
        name: 'Original',
        description: 'Original desc'
      })

      const response = await app.inject({
        method: 'PUT',
        url: `/api/characters/${character.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { name: 'Updated', description: 'Updated desc' }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.name).toBe('Updated')
      expect(data.description).toBe('Updated desc')
    })
  })

  describe('DELETE /api/characters/:id', () => {
    it('should delete a character', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)
      const character = await createTestCharacter(app, user, project.id, { name: 'To Delete' })

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/characters/${character.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(deleteResponse.statusCode).toBe(204)

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/characters/${character.id}`,
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      // After deletion, ownership check may return 403 before 404
      expect([404, 403]).toContain(getResponse.statusCode)
    })
  })
})
