import { describe, it, expect } from 'vitest'
import {
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale
} from '../src/services/image-generation.js'

describe('image-generation', () => {
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
