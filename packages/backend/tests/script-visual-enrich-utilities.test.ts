import { describe, it, expect } from 'vitest'
import { sanitizeLocationImagePromptForImageApi } from '../src/services/script-visual-enrich.js'

describe('script-visual-enrich utilities', () => {
  describe('sanitizeLocationImagePromptForImageApi', () => {
    it('replaces 刑讯室 with 会谈室', () => {
      const result = sanitizeLocationImagePromptForImageApi('一个刑讯室场景')
      expect(result).toBe('一个会谈室场景')
    })

    it('replaces 审讯室 with 会谈室', () => {
      const result = sanitizeLocationImagePromptForImageApi('在审讯室里')
      expect(result).toBe('在会谈室里')
    })

    it('replaces 看守所 with 院落建筑', () => {
      const result = sanitizeLocationImagePromptForImageApi('看守所外景')
      expect(result).toBe('院落建筑外景')
    })

    it('replaces 禁闭室 with 小房间', () => {
      const result = sanitizeLocationImagePromptForImageApi('禁闭室内')
      expect(result).toBe('小房间内')
    })

    it('replaces 关押室 with 封闭房间', () => {
      const result = sanitizeLocationImagePromptForImageApi('关押室场景')
      expect(result).toBe('封闭房间场景')
    })

    it('replaces 羁押室 with 等候室', () => {
      const result = sanitizeLocationImagePromptForImageApi('羁押室中')
      expect(result).toBe('等候室中')
    })

    it('replaces 留置室 with 等候室', () => {
      const result = sanitizeLocationImagePromptForImageApi('留置室环境')
      expect(result).toBe('等候室环境')
    })

    it('replaces 监狱 with 封闭建筑内部', () => {
      const result = sanitizeLocationImagePromptForImageApi('监狱走廊')
      expect(result).toBe('封闭建筑内部走廊')
    })

    it('replaces 刑讯 with 问话', () => {
      const result = sanitizeLocationImagePromptForImageApi('刑讯场景')
      expect(result).toBe('问话场景')
    })

    it('replaces 审讯 with 会谈', () => {
      const result = sanitizeLocationImagePromptForImageApi('审讯过程')
      expect(result).toBe('会谈过程')
    })

    it('replaces multiple occurrences', () => {
      const result = sanitizeLocationImagePromptForImageApi('刑讯室和审讯室')
      expect(result).toBe('会谈室和会谈室')
    })

    it('replaces longer terms first to avoid partial matches', () => {
      // 刑讯室 should be replaced before 刑讯
      const result = sanitizeLocationImagePromptForImageApi('刑讯室里的刑讯')
      expect(result).toBe('会谈室里的问话')
    })

    it('returns unchanged text when no sensitive words', () => {
      const result = sanitizeLocationImagePromptForImageApi('办公室场景')
      expect(result).toBe('办公室场景')
    })

    it('handles empty string', () => {
      const result = sanitizeLocationImagePromptForImageApi('')
      expect(result).toBe('')
    })

    it('handles text with multiple different sensitive words', () => {
      const result = sanitizeLocationImagePromptForImageApi('监狱里的审讯室和看守所')
      expect(result).toBe('封闭建筑内部里的会谈室和院落建筑')
    })
  })
})
