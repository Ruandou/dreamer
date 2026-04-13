import { describe, it, expect } from 'vitest'
import { strengthToGuidanceScale } from '../src/services/image-generation.js'

describe('image-generation', () => {
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
