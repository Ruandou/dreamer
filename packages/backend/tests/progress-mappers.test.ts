import { describe, it, expect } from 'vitest'
import {
  mapBatchProgressToParseRange,
  calculateEpisodePercentage,
  mapThreePhaseProgress,
  mapLegacyProgress
} from '../src/services/progress-mappers.js'

describe('progress-mappers', () => {
  describe('mapBatchProgressToParseRange', () => {
    it('maps 0% batch progress to 8%', () => {
      expect(mapBatchProgressToParseRange(0)).toBe(8)
    })

    it('maps 100% batch progress to 28%', () => {
      expect(mapBatchProgressToParseRange(100)).toBe(28)
    })

    it('maps 50% batch progress to 18%', () => {
      expect(mapBatchProgressToParseRange(50)).toBe(18)
    })

    it('clamps values above 100% to 28%', () => {
      expect(mapBatchProgressToParseRange(150)).toBe(28)
    })

    it('handles negative values gracefully', () => {
      // Math.min(100, -10) = -10, then -10/100 * 20 = -2, 8 + (-2) = 6
      expect(mapBatchProgressToParseRange(-10)).toBe(6)
    })
  })

  describe('calculateEpisodePercentage', () => {
    it('returns 0% for the first episode', () => {
      expect(calculateEpisodePercentage(1, 5)).toBe(0)
    })

    it('returns 100% for the last episode', () => {
      expect(calculateEpisodePercentage(5, 5)).toBe(100)
    })

    it('returns 50% for the middle episode of 3', () => {
      expect(calculateEpisodePercentage(2, 3)).toBe(50)
    })

    it('returns 0% when total is 1 (avoids division by zero)', () => {
      expect(calculateEpisodePercentage(1, 1)).toBe(0)
    })

    it('calculates evenly spaced percentages', () => {
      expect(calculateEpisodePercentage(1, 4)).toBe(0)
      expect(calculateEpisodePercentage(2, 4)).toBe(33)
      expect(calculateEpisodePercentage(3, 4)).toBe(67)
      expect(calculateEpisodePercentage(4, 4)).toBe(100)
    })
  })

  describe('mapThreePhaseProgress', () => {
    it('maps 0% to 20%', () => {
      expect(mapThreePhaseProgress(0)).toBe(20)
    })

    it('maps 100% to 95%', () => {
      expect(mapThreePhaseProgress(100)).toBe(95)
    })

    it('maps 50% to 58%', () => {
      expect(mapThreePhaseProgress(50)).toBe(58)
    })
  })

  describe('mapLegacyProgress', () => {
    it('returns the same percentage when below 99%', () => {
      expect(mapLegacyProgress(50)).toBe(50)
      expect(mapLegacyProgress(98)).toBe(98)
    })

    it('caps at 99% when input is 100%', () => {
      expect(mapLegacyProgress(100)).toBe(99)
    })

    it('caps at 99% when input exceeds 100%', () => {
      expect(mapLegacyProgress(150)).toBe(99)
    })
  })
})
