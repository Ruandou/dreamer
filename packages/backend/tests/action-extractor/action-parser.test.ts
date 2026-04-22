import { describe, it, expect } from 'vitest'
import {
  parseActionText,
  extractImpliedActions
} from '../../src/services/action-extractor/action-parser.ts'

describe('Action Parser', () => {
  describe('parseActionText', () => {
    it('should parse simple action text with character', () => {
      const result = parseActionText('主角走进房间', ['主角'])
      expect(result).not.toBeNull()
      expect(result?.characterName).toBe('主角')
      expect(result?.description).toBe('主角走进房间')
    })

    it('should return null for unknown character', () => {
      const result = parseActionText('他走进房间', ['Alice', 'Bob'])
      expect(result).toBeNull()
    })

    it('should classify action type correctly', () => {
      const result = parseActionText('Alice微笑着打招呼', ['Alice'])
      expect(result?.actionType).toBe('expression')
    })

    it('should infer emotion from action', () => {
      const result = parseActionText('Bob愤怒地拍桌子', ['Bob'])
      expect(result?.emotion).toBeDefined()
    })

    it('should return null for empty input', () => {
      expect(parseActionText('', ['主角'])).toBeNull()
    })
  })

  describe('extractImpliedActions', () => {
    it('should extract actions matching pattern', () => {
      const result = extractImpliedActions('Alice低着头，Bob微笑着', ['Alice', 'Bob'])
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some((a) => a.characterName === 'Alice')).toBe(true)
    })

    it('should return empty for non-matching description', () => {
      const result = extractImpliedActions('今天天气不错', ['Alice', 'Bob'])
      expect(result).toEqual([])
    })

    it('should only extract actions for known characters', () => {
      const result = extractImpliedActions('Unknown低着头，Alice微笑着', ['Alice'])
      expect(result.length).toBe(1)
      expect(result[0].characterName).toBe('Alice')
    })
  })
})
