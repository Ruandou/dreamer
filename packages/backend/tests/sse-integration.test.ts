import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import { sendTaskUpdate, sendProjectUpdate } from '../src/plugins/sse.js'

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

    it('sendTaskUpdate and sendProjectUpdate serialize payload', () => {
      expect(() => sendTaskUpdate('user-123', 't1', 'running', { pct: 0.5 })).not.toThrow()
      expect(() =>
        sendProjectUpdate('user-123', 'proj-1', 'image-generation', { status: 'completed' })
      ).not.toThrow()
    })
  })

  describe('sse.subscribe connection lifecycle', () => {
    it('opens SSE with token in query and accepts subsequent sendToUser', async () => {
      vi.useFakeTimers()
      const writes: string[] = []
      const reply = {
        raw: {
          writeHead: vi.fn(),
          write: vi.fn((msg: string) => {
            writes.push(msg)
          })
        }
      }
      const listeners: Record<string, () => void> = {}
      const request = {
        query: { subscribe: 'valid-token' },
        headers: {} as Record<string, string>,
        raw: {
          on: vi.fn((ev: string, fn: () => void) => {
            if (ev === 'close') listeners.close = fn
          })
        }
      }
      await app.sse.subscribe(request as any, reply as any)
      expect(reply.raw.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ 'Content-Type': 'text/event-stream' })
      )
      expect(writes.some((w) => w.includes('connected'))).toBe(true)

      app.sse.sendToUser('user-123', 'custom', { ok: true })
      expect(writes.some((w) => w.includes('custom'))).toBe(true)

      vi.advanceTimersByTime(30000)
      listeners.close?.()
      vi.useRealTimers()
    })

    it('falls back to anonymous when no token', async () => {
      const reply = { raw: { writeHead: vi.fn(), write: vi.fn() } }
      const request = {
        query: {},
        headers: {},
        raw: { on: vi.fn() }
      }
      await app.sse.subscribe(request as any, reply as any)
      expect(reply.raw.write).toHaveBeenCalled()
    })
  })
})
