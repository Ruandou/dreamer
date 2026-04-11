import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the outline queue functions indirectly through the routes
describe('Outline Queue Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createOutlineJob', () => {
    it('should be importable from outline queue module', async () => {
      // The actual implementation is tested through the routes
      // This just verifies the module can be imported
      const module = await import('../src/queues/outline.js')
      expect(typeof module.createOutlineJob).toBe('function')
    })
  })

  describe('getOutlineJob', () => {
    it('should be importable from outline queue module', async () => {
      const module = await import('../src/queues/outline.js')
      expect(typeof module.getOutlineJob).toBe('function')
    })
  })
})
