import { describe, it, expect } from 'vitest'
import {
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale,
  normalizeArkImageSize,
  ARK_IMAGE_MIN_TOTAL_PIXELS
} from '../src/services/image-generation.js'

describe('image-generation', () => {
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
