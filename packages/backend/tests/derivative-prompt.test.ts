import { describe, it, expect } from 'vitest'
import { buildDerivativePrompt } from '../src/services/visual-enrich/derivative-prompt.js'

describe('buildDerivativePrompt', () => {
  it('returns empty string for empty prompt', () => {
    expect(buildDerivativePrompt('base', '')).toBe('')
  })

  it('returns empty string for whitespace-only prompt', () => {
    expect(buildDerivativePrompt('base', '   ')).toBe('')
  })

  it('returns as-is for "same person" phrase', () => {
    const prompt = 'same person wearing red'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for "same identity" phrase', () => {
    const prompt = 'same identity, new outfit'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for "same character" phrase', () => {
    const prompt = 'same character smiling'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for "same face" phrase', () => {
    const prompt = 'same face, different pose'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for "base reference" phrase', () => {
    const prompt = 'base reference maintained'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for "unchanged" phrase', () => {
    const prompt = 'face unchanged, new clothes'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for "consistent with" phrase', () => {
    const prompt = 'consistent with base image'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for Chinese "同一人" phrase', () => {
    const prompt = '同一人，不同服装'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for Chinese "与基础" phrase', () => {
    const prompt = '与基础形象相同'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for Chinese "保持一致" phrase', () => {
    const prompt = '面部特征保持一致'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for Chinese "参考基础" phrase', () => {
    const prompt = '参考基础定妆'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for Chinese "与基础定妆" phrase', () => {
    const prompt = '与基础定妆一致'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for Chinese "相同人物" phrase', () => {
    const prompt = '相同人物不同表情'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('returns as-is for Chinese "同一人物" phrase', () => {
    const prompt = '同一人物新造型'
    expect(buildDerivativePrompt('base', prompt)).toBe(prompt)
  })

  it('prepends anchor when base is long enough', () => {
    const base = 'A'.repeat(20)
    const result = buildDerivativePrompt(base, 'new outfit')
    expect(result).toContain('与基础定妆为同一人')
    expect(result).toContain('new outfit')
  })

  it('uses short base fallback when base is too short', () => {
    const result = buildDerivativePrompt('short', 'new outfit')
    expect(result).toBe('与基础定妆为同一人；保持面部结构与年龄感一致；new outfit')
  })

  it('uses short base fallback when base is null', () => {
    const result = buildDerivativePrompt(null, 'new outfit')
    expect(result).toBe('与基础定妆为同一人；保持面部结构与年龄感一致；new outfit')
  })

  it('uses short base fallback when base is undefined', () => {
    const result = buildDerivativePrompt(undefined, 'new outfit')
    expect(result).toBe('与基础定妆为同一人；保持面部结构与年龄感一致；new outfit')
  })

  it('trims base anchor and normalizes whitespace', () => {
    const base = '  base   anchor  with   spaces  '
    const result = buildDerivativePrompt(base, 'new outfit')
    expect(result).toContain('base anchor with spaces')
  })

  it('truncates long base anchor to 220 chars', () => {
    const base = 'A'.repeat(300)
    const result = buildDerivativePrompt(base, 'new outfit')
    const match = result.match(/（(A+)）/)
    expect(match?.[1].length).toBe(220)
  })
})
