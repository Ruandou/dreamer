import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getPipelineJobHandler,
  registerPipelineJobHandler
} from '../src/queues/pipeline-job-strategies.ts'

describe('Pipeline Job Strategies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPipelineJobHandler', () => {
    it('should return handler for episode-storyboard-script job type', async () => {
      const handler = getPipelineJobHandler('episode-storyboard-script')
      expect(handler).toBeDefined()
      expect(typeof handler).toBe('function')
    })

    it('should return handler for full-pipeline job type', async () => {
      const handler = getPipelineJobHandler('full-pipeline')
      expect(handler).toBeDefined()
      expect(typeof handler).toBe('function')
    })

    it('should throw error for unknown job type', () => {
      expect(() => getPipelineJobHandler('unknown-type')).toThrow()
    })

    it('should throw error with available types in message', () => {
      try {
        getPipelineJobHandler('unknown-type')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('full-pipeline')
        expect((error as Error).message).toContain('episode-storyboard-script')
      }
    })
  })

  describe('registerPipelineJobHandler', () => {
    it('should allow registering custom handlers', () => {
      const customHandler = vi.fn()
      registerPipelineJobHandler('custom-job', customHandler)

      const handler = getPipelineJobHandler('custom-job')
      expect(handler).toBe(customHandler)
    })
  })
})
