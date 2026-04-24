import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetApiCalls = vi.fn()
vi.mock('../src/services/ai/api-logger.js', () => ({
  getApiCalls: (...args: unknown[]) => mockGetApiCalls(...args),
  parseModelApiRequestParams: (params: unknown) => params
}))

import {
  parseListQuery,
  listModelApiCallsForUser
} from '../src/services/ai/model-api-call-service.js'

describe('model-api-call-service', () => {
  beforeEach(() => {
    mockGetApiCalls.mockReset()
  })

  describe('parseListQuery', () => {
    it('parses limit and offset', () => {
      const query = {
        limit: '20',
        offset: '40'
      }

      const result = parseListQuery(query)

      expect(result.lim).toBe(20)
      expect(result.off).toBe(40)
    })

    it('uses defaults when not provided', () => {
      const query = {}

      const result = parseListQuery(query)

      expect(result.lim).toBe(50)
      expect(result.off).toBe(0)
    })

    it('uses default when limit is invalid', () => {
      const query = {
        limit: 'invalid'
      }

      const result = parseListQuery(query)

      expect(result.lim).toBe(50)
    })

    it('uses default when offset is negative', () => {
      const query = {
        offset: '-10'
      }

      const result = parseListQuery(query)

      expect(result.off).toBe(0)
    })

    it('parses model filter', () => {
      const query = {
        model: 'gpt-4'
      }

      const result = parseListQuery(query)

      expect(result.filters.model).toBe('gpt-4')
    })

    it('handles empty model filter', () => {
      const query = {
        model: ''
      }

      const result = parseListQuery(query)

      expect(result.filters.model).toBeUndefined()
    })
  })

  describe('listModelApiCallsForUser', () => {
    it('calls getApiCalls with correct query', async () => {
      mockGetApiCalls.mockResolvedValue({
        items: [
          {
            id: 'call-1',
            model: 'gpt-4',
            status: 'completed'
          }
        ],
        total: 1
      })

      const result = await listModelApiCallsForUser('user-1', {
        limit: '10',
        offset: '0'
      })

      expect(mockGetApiCalls).toHaveBeenCalledWith('user-1', expect.any(Object))
      expect(result.items).toHaveLength(1)
      expect(result.limit).toBe(10)
      expect(result.offset).toBe(0)
    })

    it('filters by model when provided', async () => {
      mockGetApiCalls.mockResolvedValue({ items: [], total: 0 })

      await listModelApiCallsForUser('user-1', {
        limit: '10',
        offset: '0',
        model: 'gpt-4'
      })

      expect(mockGetApiCalls).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          model: 'gpt-4'
        })
      )
    })

    it('returns empty array when no results', async () => {
      mockGetApiCalls.mockResolvedValue({ items: [], total: 0 })

      const result = await listModelApiCallsForUser('user-1', {
        limit: '10',
        offset: '0'
      })

      expect(result.items).toEqual([])
    })

    it('uses custom limit and offset', async () => {
      mockGetApiCalls.mockResolvedValue({ items: [], total: 0 })

      const result = await listModelApiCallsForUser('user-1', {
        limit: '50',
        offset: '100'
      })

      expect(result.limit).toBe(50)
      expect(result.offset).toBe(100)
    })
  })
})
