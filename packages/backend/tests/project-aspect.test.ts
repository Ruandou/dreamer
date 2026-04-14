import { describe, it, expect } from 'vitest'
import {
  normalizeProjectDefaultAspectRatio,
  pipelineAspectRatioFromProjectDefault
} from '../src/lib/project-aspect.js'

describe('project-aspect', () => {
  describe('normalizeProjectDefaultAspectRatio', () => {
    it('accepts known ratios', () => {
      expect(normalizeProjectDefaultAspectRatio('16:9')).toBe('16:9')
      expect(normalizeProjectDefaultAspectRatio('9:16')).toBe('9:16')
    })
    it('defaults unknown to 9:16', () => {
      expect(normalizeProjectDefaultAspectRatio('')).toBe('9:16')
      expect(normalizeProjectDefaultAspectRatio('2:1')).toBe('9:16')
    })
  })

  describe('pipelineAspectRatioFromProjectDefault', () => {
    it('passes through 16:9 / 9:16 / 1:1', () => {
      expect(pipelineAspectRatioFromProjectDefault('16:9')).toBe('16:9')
      expect(pipelineAspectRatioFromProjectDefault('9:16')).toBe('9:16')
      expect(pipelineAspectRatioFromProjectDefault('1:1')).toBe('1:1')
    })
    it('maps 4:3 to 9:16 for pipeline subset', () => {
      expect(pipelineAspectRatioFromProjectDefault('4:3')).toBe('9:16')
    })
  })
})
