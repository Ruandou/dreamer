import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject } from '../fixtures/project.fixture.js'
import type { FastifyInstance } from 'fastify'

// Mock the AI parser to avoid external API calls during e2e tests
vi.mock('../../src/services/ai/parser.js', () => ({
  parseScriptDocument: vi.fn().mockResolvedValue({
    parsed: {
      projectName: 'Test Project',
      description: 'A test description',
      characters: [{ name: 'Alice', description: 'Main character' }],
      episodes: [
        {
          episodeNum: 1,
          title: 'Episode 1',
          scenes: [{ sceneNum: 1, description: 'Scene 1 description that is long enough' }]
        }
      ]
    },
    cost: { costCNY: 0.5 }
  })
}))

// Mock import queue to avoid BullMQ dependency
vi.mock('../../src/queues/import.js', () => ({
  importQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' })
  }
}))

describe('Import E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/import/preview', () => {
    it('should preview markdown script content', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/import/preview',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          content: '# Test Script\n\n## Episode 1\n\nScene 1: Opening scene',
          type: 'markdown'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.preview).toBeDefined()
      expect(data.preview.projectName).toBe('Test Project')
      expect(data.preview.episodes).toBeInstanceOf(Array)
      expect(data.aiCost).toBeDefined()
    })

    it('should reject preview without content', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/import/preview',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { type: 'markdown' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBeDefined()
    })

    it('should reject unauthenticated preview', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/import/preview',
        payload: {
          content: 'test',
          type: 'markdown'
        }
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/import/script', () => {
    it('should enqueue script import for existing project', async () => {
      const user = await createTestUser(app)
      const project = await createTestProject(app, user)

      const response = await app.inject({
        method: 'POST',
        url: '/api/import/script',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          projectId: project.id,
          content: '# Test Script',
          type: 'markdown'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.taskId).toBeDefined()
      expect(data.status).toBe('pending')
    })

    it('should reject script import without projectId', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/import/script',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          content: '# Test Script',
          type: 'markdown'
        }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBeDefined()
    })

    it('should reject script import for non-owned project', async () => {
      const userA = await createTestUser(app)
      const userB = await createTestUser(app)
      const project = await createTestProject(app, userA)

      const response = await app.inject({
        method: 'POST',
        url: '/api/import/script',
        headers: { authorization: `Bearer ${userB.accessToken}` },
        payload: {
          projectId: project.id,
          content: '# Test Script',
          type: 'markdown'
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('POST /api/import/project', () => {
    it('should enqueue project import (create new project)', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/import/project',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          content: '# New Project Script',
          type: 'markdown'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.taskId).toBeDefined()
      expect(data.status).toBe('pending')
    })

    it('should reject project import without content', async () => {
      const user = await createTestUser(app)

      const response = await app.inject({
        method: 'POST',
        url: '/api/import/project',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: { type: 'markdown' }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('缺少必要参数')
    })
  })

  describe('GET /api/import/tasks', () => {
    it('should list import tasks for user', async () => {
      const user = await createTestUser(app)

      // Create a task first
      await app.inject({
        method: 'POST',
        url: '/api/import/project',
        headers: { authorization: `Bearer ${user.accessToken}` },
        payload: {
          content: '# Test',
          type: 'markdown'
        }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/import/tasks',
        headers: { authorization: `Bearer ${user.accessToken}` }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.tasks).toBeInstanceOf(Array)
      expect(data.total).toBeGreaterThanOrEqual(1)
    })
  })
})
