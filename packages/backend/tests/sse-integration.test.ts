import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Mock jwt verify
vi.mock('@fastify/jwt', () => ({
  default: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockImplementation((token: string) => {
      if (token === 'valid-token') {
        return Promise.resolve({ id: 'user-123' })
      }
      throw new Error('Invalid token')
    })
  })),
  fastifyJwt: vi.fn()
}))

describe('SSE Plugin Integration', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Register SSE plugin
    const { ssePlugin } = await import('../src/plugins/sse.js')
    app.register(ssePlugin)

    // Decorate with jwt
    app.decorate('jwt', {
      verify: vi.fn().mockImplementation((token: string) => {
        if (token === 'valid-token') {
          return Promise.resolve({ id: 'user-123' })
        }
        throw new Error('Invalid token')
      })
    })

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sse.subscribe', () => {
    it('should export sse plugin with subscribe function', async () => {
      expect(app.sse).toBeDefined()
      expect(typeof app.sse.subscribe).toBe('function')
    })

    it('should export sse plugin with sendToUser function', async () => {
      expect(app.sse).toBeDefined()
      expect(typeof app.sse.sendToUser).toBe('function')
    })
  })

  describe('SSE Message Sending', () => {
    it('should send message to user without errors', async () => {
      expect(() => {
        app.sse.sendToUser('user-123', 'test-event', { data: 'test' })
      }).not.toThrow()
    })

    it('should send task update without errors', async () => {
      expect(() => {
        app.sse.sendToUser('user-123', 'task-update', {
          taskId: 'task-456',
          status: 'completed'
        })
      }).not.toThrow()
    })
  })
})
