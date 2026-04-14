import { describe, it, expect, afterEach } from 'vitest'
import {
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale,
  normalizeArkImageSize,
  ARK_IMAGE_MIN_TOTAL_PIXELS,
  extractImageCostFromArkResponse,
  arkImageSizeFromProjectAspectRatio
} from '../src/services/image-generation.js'

describe('image-generation', () => {
  describe('arkImageSizeFromProjectAspectRatio', () => {
    it('maps 9:16 to portrait size meeting Ark min pixels', () => {
      expect(arkImageSizeFromProjectAspectRatio('9:16')).toBe('1440x2560')
    })
    it('maps 16:9 and 1:1', () => {
      expect(arkImageSizeFromProjectAspectRatio('16:9')).toBe('2560x1440')
      expect(arkImageSizeFromProjectAspectRatio('1:1')).toBe('1920x1920')
    })
    it('falls back for garbage', () => {
      expect(arkImageSizeFromProjectAspectRatio('bad')).toBe('1440x2560')
    })
  })

  describe('normalizeArkImageSize', () => {
    it('bumps 1024x1024 to 1920x1920 (below Ark min total pixels)', () => {
      expect(normalizeArkImageSize('1024x1024')).toBe('1920x1920')
      expect(1024 * 1024).toBeLessThan(ARK_IMAGE_MIN_TOTAL_PIXELS)
    })
    it('keeps adaptive and empty as default', () => {
      expect(normalizeArkImageSize('adaptive')).toBe('1920x1920')
      expect(normalizeArkImageSize(undefined)).toBe('1920x1920')
      expect(normalizeArkImageSize('')).toBe('1920x1920')
    })
    it('keeps sizes meeting minimum', () => {
      expect(normalizeArkImageSize('1920x1920')).toBe('1920x1920')
      expect(normalizeArkImageSize('2560x1440')).toBe('2560x1440')
      expect(2560 * 1440).toBe(ARK_IMAGE_MIN_TOTAL_PIXELS)
    })
    it('returns default for garbage', () => {
      expect(normalizeArkImageSize('large')).toBe('1920x1920')
    })
  })

  describe('extractImageCostFromArkResponse', () => {
    const prev = process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
    afterEach(() => {
      if (prev === undefined) delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      else process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS = prev
    })

    it('returns null when no usage or tokens', () => {
      expect(extractImageCostFromArkResponse({ data: [] })).toBeNull()
      expect(extractImageCostFromArkResponse({ usage: {} })).toBeNull()
    })
    it('estimates from usage.total_tokens with default ¥/M', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(extractImageCostFromArkResponse({ usage: { total_tokens: 1_000_000 } })).toBe(4)
      expect(extractImageCostFromArkResponse({ usage: { total_tokens: 500_000 } })).toBe(2)
    })
    it('respects ARK_IMAGE_YUAN_PER_MILLION_TOKENS', () => {
      process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS = '10'
      expect(extractImageCostFromArkResponse({ usage: { total_tokens: 1_000_000 } })).toBe(10)
    })
    it('falls back to billing_tokens on usage or root', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(extractImageCostFromArkResponse({ usage: { billing_tokens: 2_000_000 } })).toBe(8)
      expect(extractImageCostFromArkResponse({ billing_tokens: 1_000_000 })).toBe(4)
    })
    it('sums input_tokens + output_tokens when total missing', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(
        extractImageCostFromArkResponse({
          usage: { input_tokens: 300_000, output_tokens: 700_000 }
        })
      ).toBe(4)
    })
  })

  describe('imageEditModelUsesGuidanceScale', () => {
    it('should be true for SeedEdit model ids', () => {
      expect(imageEditModelUsesGuidanceScale('doubao-seededit-3-0-i2i-250628')).toBe(true)
    })
    it('should be false for Seedream model ids', () => {
      expect(imageEditModelUsesGuidanceScale('doubao-seedream-5-0-lite-260128')).toBe(false)
    })
  })

  describe('strengthToGuidanceScale', () => {
    it('should map strength to guidance_scale in 4–9 range', () => {
      expect(strengthToGuidanceScale(0)).toBe(4)
      expect(strengthToGuidanceScale(1)).toBe(9)
      expect(strengthToGuidanceScale(0.35)).toBe(6)
    })
    it('should clamp out-of-range values', () => {
      expect(strengthToGuidanceScale(-1)).toBe(4)
      expect(strengthToGuidanceScale(2)).toBe(9)
    })
  })
})
