import { describe, it, expect } from 'vitest'
import { buildCharacterImageStyledPrompt } from '../../src/lib/character-image-prompt.js'

describe('buildCharacterImageStyledPrompt', () => {
  const antiCelebritySuffix = '。原创虚构角色设计，非真实人物，避免与任何现实人物相似。'

  it('returns corePrompt with anti-celebrity suffix when no visualStyle', () => {
    const result = buildCharacterImageStyledPrompt(undefined, '一个年轻男性角色')
    expect(result).toBe(`一个年轻男性角色${antiCelebritySuffix}`)
  })

  it('returns corePrompt with anti-celebrity suffix when empty visualStyle', () => {
    const result = buildCharacterImageStyledPrompt([], '核心描述')
    expect(result).toBe(`核心描述${antiCelebritySuffix}`)
  })

  it('returns corePrompt with anti-celebrity suffix when visualStyle has empty strings', () => {
    const result = buildCharacterImageStyledPrompt(['', '', '  '], '核心描述')
    expect(result).toBe(`核心描述${antiCelebritySuffix}`)
  })

  it('prepends visual style and appends anti-celebrity suffix', () => {
    const result = buildCharacterImageStyledPrompt(
      ['写实风格', '电影级画质'],
      '年轻女性，长发，微笑'
    )
    expect(result).toBe(
      `Visual style: 写实风格, 电影级画质. 年轻女性，长发，微笑${antiCelebritySuffix}`
    )
  })

  it('prepends single visual style and appends anti-celebrity suffix', () => {
    const result = buildCharacterImageStyledPrompt(['古风'], '男侠客，剑眉星目')
    expect(result).toBe(`Visual style: 古风. 男侠客，剑眉星目${antiCelebritySuffix}`)
  })

  it('filters out empty visual styles but still appends anti-celebrity suffix', () => {
    const result = buildCharacterImageStyledPrompt(['写实风格', '', '高画质'], '角色正面')
    expect(result).toBe(`Visual style: 写实风格, 高画质. 角色正面${antiCelebritySuffix}`)
  })
})
