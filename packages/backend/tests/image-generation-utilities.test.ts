import { describe, it, expect } from 'vitest'
import {
  normalizeArkImageSize,
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale,
  extractImageCostFromArkResponse
} from '../src/services/ai/image-generation.js'

describe('image-generation utilities', () => {
  describe('normalizeArkImageSize', () => {
    it('returns default for undefined', () => {
      expect(normalizeArkImageSize(undefined)).toBe('1920x1920')
    })

    it('returns default for empty string', () => {
      expect(normalizeArkImageSize('')).toBe('1920x1920')
    })

    it('returns default for adaptive', () => {
      expect(normalizeArkImageSize('adaptive')).toBe('1920x1920')
    })

    it('returns default for invalid format', () => {
      expect(normalizeArkImageSize('invalid')).toBe('1920x1920')
    })

    it('returns valid size when above minimum pixels', () => {
      // 1920x1920 = 3,686,400 (exactly at minimum)
      expect(normalizeArkImageSize('1920x1920')).toBe('1920x1920')
    })

    it('returns default for size below minimum pixels', () => {
      // 1000x1000 = 1,000,000 (below minimum of 3,686,400)
      expect(normalizeArkImageSize('1000x1000')).toBe('1920x1920')
    })

    it('handles large valid sizes', () => {
      expect(normalizeArkImageSize('2560x1440')).toBe('2560x1440')
    })

    it('handles sizes with spaces', () => {
      expect(normalizeArkImageSize('1920 x 1920')).toBe('1920x1920')
    })

    it('handles different case', () => {
      expect(normalizeArkImageSize('1920X1920')).toBe('1920x1920')
    })

    it('rejects zero dimensions', () => {
      expect(normalizeArkImageSize('0x1920')).toBe('1920x1920')
      expect(normalizeArkImageSize('1920x0')).toBe('1920x1920')
    })

    it('rejects negative dimensions', () => {
      expect(normalizeArkImageSize('-100x100')).toBe('1920x1920')
    })
  })

  describe('strengthToGuidanceScale', () => {
    it('converts 0 to 4', () => {
      expect(strengthToGuidanceScale(0)).toBe(4)
    })

    it('converts 0.5 to 7', () => {
      expect(strengthToGuidanceScale(0.5)).toBe(7)
    })

    it('converts 1 to 9', () => {
      expect(strengthToGuidanceScale(1)).toBe(9)
    })

    it('clamps negative values to 0', () => {
      expect(strengthToGuidanceScale(-1)).toBe(4)
    })

    it('clamps values above 1 to 1', () => {
      expect(strengthToGuidanceScale(2)).toBe(9)
    })

    it('handles 0.35 default', () => {
      expect(strengthToGuidanceScale(0.35)).toBe(6)
    })
  })

  describe('imageEditModelUsesGuidanceScale', () => {
    it('returns true for SeedEdit models', () => {
      expect(imageEditModelUsesGuidanceScale('seededit')).toBe(true)
      expect(imageEditModelUsesGuidanceScale('SeedEdit')).toBe(true)
      expect(imageEditModelUsesGuidanceScale('SEEDEDIT-2.0')).toBe(true)
      expect(imageEditModelUsesGuidanceScale('doubao-seededit-3.0')).toBe(true)
    })

    it('returns false for non-SeedEdit models', () => {
      expect(imageEditModelUsesGuidanceScale('doubao-seedream-5.0')).toBe(false)
      expect(imageEditModelUsesGuidanceScale('other-model')).toBe(false)
    })
  })

  describe('extractImageCostFromArkResponse', () => {
    it('extracts cost from usage.total_tokens', () => {
      const response = {
        usage: {
          total_tokens: 500000
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      // 500,000 tokens at 4 yuan per million = 2 yuan
      expect(cost).toBeCloseTo(2, 2)
    })

    it('extracts cost from usage.billing_tokens', () => {
      const response = {
        usage: {
          billing_tokens: 1000000
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeCloseTo(4, 2)
    })

    it('extracts cost from root billing_tokens', () => {
      const response = {
        billing_tokens: 250000
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeCloseTo(1, 2)
    })

    it('extracts cost from input + output tokens', () => {
      const response = {
        usage: {
          input_tokens: 300000,
          output_tokens: 200000
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeCloseTo(2, 2)
    })

    it('extracts cost from prompt + completion tokens', () => {
      const response = {
        usage: {
          prompt_tokens: 400000,
          completion_tokens: 100000
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeCloseTo(2, 2)
    })

    it('prefers total_tokens over other fields', () => {
      const response = {
        usage: {
          total_tokens: 1000000,
          input_tokens: 500000,
          output_tokens: 500000
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeCloseTo(4, 2)
    })

    it('returns null when no token information', () => {
      const response = {
        data: [{ url: 'https://example.com/image.png' }]
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeNull()
    })

    it('returns null when usage is not an object', () => {
      const response = {
        usage: 'invalid'
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeNull()
    })

    it('handles zero tokens', () => {
      const response = {
        usage: {
          total_tokens: 0
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeNull()
    })

    it('handles very small token counts', () => {
      const response = {
        usage: {
          total_tokens: 1000
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      // 1,000 tokens at 4 yuan per million = 0.004 yuan
      expect(cost).toBeCloseTo(0.004, 3)
    })

    it('handles large token counts', () => {
      const response = {
        usage: {
          total_tokens: 5000000
        }
      }
      const cost = extractImageCostFromArkResponse(response as any)
      expect(cost).toBeCloseTo(20, 2)
    })
  })
})
