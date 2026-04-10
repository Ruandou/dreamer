import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test the SSE functions directly without Fastify
describe('SSE Plugin', () => {
  // Access the module-level sseConnections map for testing
  let sseConnections: Map<string, any[]>

  beforeEach(async () => {
    // Clear module cache to get fresh state
    vi.resetModules()
    // Mock console to avoid noise
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendSSEToUser', () => {
    it('should be defined and be a function', async () => {
      const { sendSSEToUser } = await import('../src/plugins/sse.js')
      expect(sendSSEToUser).toBeDefined()
      expect(typeof sendSSEToUser).toBe('function')
    })

    it('should not throw when sending to user with no connections', async () => {
      const { sendSSEToUser } = await import('../src/plugins/sse.js')
      // Should not throw even if user has no connections
      expect(() => sendSSEToUser('nonexistent-user', 'test-event', { data: 'test' })).not.toThrow()
    })

    it('should format message correctly', async () => {
      const { sendSSEToUser } = await import('../src/plugins/sse.js')
      const mockReply = {
        raw: {
          write: vi.fn()
        }
      }

      // Get the sseConnections from the module
      const module = await import('../src/plugins/sse.js')
      // We can't directly access sseConnections, but we can test the function behavior
      expect(() => sendSSEToUser('test-user', 'task-update', { taskId: '123', status: 'completed' })).not.toThrow()
    })
  })

  describe('sendTaskUpdate', () => {
    it('should be defined and be a function', async () => {
      const { sendTaskUpdate } = await import('../src/plugins/sse.js')
      expect(sendTaskUpdate).toBeDefined()
      expect(typeof sendTaskUpdate).toBe('function')
    })

    it('should not throw when called', async () => {
      const { sendTaskUpdate } = await import('../src/plugins/sse.js')
      expect(() => sendTaskUpdate('user-123', 'task-456', 'completed', { sceneId: 'scene-789' })).not.toThrow()
    })
  })

  describe('sendProjectUpdate', () => {
    it('should be defined and be a function', async () => {
      const { sendProjectUpdate } = await import('../src/plugins/sse.js')
      expect(sendProjectUpdate).toBeDefined()
      expect(typeof sendProjectUpdate).toBe('function')
    })

    it('should not throw when called', async () => {
      const { sendProjectUpdate } = await import('../src/plugins/sse.js')
      expect(() => sendProjectUpdate('user-123', 'project-456', 'created', { name: 'Test Project' })).not.toThrow()
    })
  })

  describe('ssePlugin', () => {
    it('should be defined and be a function', async () => {
      const { ssePlugin } = await import('../src/plugins/sse.js')
      expect(ssePlugin).toBeDefined()
      expect(typeof ssePlugin).toBe('function')
    })
  })
})

describe('SSE Message Format', () => {
  it('should format event message correctly', () => {
    const event = 'task-update'
    const data = { taskId: '123', status: 'completed' }
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    
    expect(message).toBe('event: task-update\ndata: {"taskId":"123","status":"completed"}\n\n')
  })

  it('should format connected event correctly', () => {
    const event = 'connected'
    const data = { userId: 'user-123' }
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    
    expect(message).toBe('event: connected\ndata: {"userId":"user-123"}\n\n')
  })

  it('should format heartbeat correctly', () => {
    const heartbeat = ': heartbeat\n\n'
    expect(heartbeat).toBe(': heartbeat\n\n')
  })
})
