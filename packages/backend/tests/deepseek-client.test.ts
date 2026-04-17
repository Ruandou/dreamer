import { describe, it, expect } from 'vitest'
import { calculateDeepSeekCost } from '../src/services/ai/deepseek-client.js'

describe('deepseek-client', () => {
  describe('calculateDeepSeekCost', () => {
    it('calculates cost for basic usage', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500
      }

      const cost = calculateDeepSeekCost(usage)

      expect(cost.inputTokens).toBe(1000)
      expect(cost.outputTokens).toBe(500)
      expect(cost.costCNY).toBeGreaterThan(0)
      expect(cost.cacheHit).toBe(false)
    })

    it('calculates higher cost for more tokens', () => {
      const usage1 = {
        prompt_tokens: 1000,
        completion_tokens: 500
      }

      const usage2 = {
        prompt_tokens: 2000,
        completion_tokens: 1000
      }

      const cost1 = calculateDeepSeekCost(usage1)
      const cost2 = calculateDeepSeekCost(usage2)

      expect(cost2.costCNY).toBeGreaterThan(cost1.costCNY)
    })

    it('calculates lower cost when cache hit', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500
      }

      const costNoCache = calculateDeepSeekCost(usage, false)
      const costWithCache = calculateDeepSeekCost(usage, true)

      expect(costWithCache.costCNY).toBeLessThan(costNoCache.costCNY)
      expect(costWithCache.cacheHit).toBe(true)
    })

    it('handles zero tokens', () => {
      const usage = {
        prompt_tokens: 0,
        completion_tokens: 0
      }

      const cost = calculateDeepSeekCost(usage)

      expect(cost.inputTokens).toBe(0)
      expect(cost.outputTokens).toBe(0)
      expect(cost.costCNY).toBe(0)
    })

    it('handles missing token fields', () => {
      const usage = {}

      const cost = calculateDeepSeekCost(usage)

      expect(cost.inputTokens).toBe(0)
      expect(cost.outputTokens).toBe(0)
      expect(cost.costCNY).toBe(0)
    })

    it('handles null usage', () => {
      const cost = calculateDeepSeekCost(null)

      expect(cost.inputTokens).toBe(0)
      expect(cost.outputTokens).toBe(0)
      expect(cost.costCNY).toBe(0)
    })

    it('handles undefined usage', () => {
      const cost = calculateDeepSeekCost(undefined)

      expect(cost.inputTokens).toBe(0)
      expect(cost.outputTokens).toBe(0)
      expect(cost.costCNY).toBe(0)
    })

    it('returns correct cost structure', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500
      }

      const cost = calculateDeepSeekCost(usage)

      expect(cost).toHaveProperty('inputTokens')
      expect(cost).toHaveProperty('outputTokens')
      expect(cost).toHaveProperty('totalTokens')
      expect(cost).toHaveProperty('costCNY')
      expect(cost).toHaveProperty('cacheHit')
      expect(cost.totalTokens).toBe(1500)
    })
  })
})
