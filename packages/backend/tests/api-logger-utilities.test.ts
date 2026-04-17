import { describe, it, expect } from 'vitest'
import { truncateForModelLog, parseModelApiRequestParams } from '../src/services/ai/api-logger.js'

describe('api-logger utilities', () => {
  describe('truncateForModelLog', () => {
    it('returns original string when under limit', () => {
      const text = 'Short text'
      const result = truncateForModelLog(text, 100)
      expect(result).toBe('Short text')
    })

    it('truncates string when over limit', () => {
      const text = 'A'.repeat(200)
      const result = truncateForModelLog(text, 100)
      expect(result.length).toBe(100 + '\n…[truncated]'.length)
      expect(result).toContain('…[truncated]')
      expect(result.startsWith('A'.repeat(100))).toBe(true)
    })

    it('uses default max length', () => {
      const text = 'A'.repeat(20000)
      const result = truncateForModelLog(text)
      expect(result.length).toBe(12000 + '\n…[truncated]'.length) // Default MODEL_LOG_PROMPT_MAX is 12000
    })

    it('handles empty string', () => {
      const result = truncateForModelLog('', 100)
      expect(result).toBe('')
    })

    it('handles string at exact limit', () => {
      const text = 'A'.repeat(100)
      const result = truncateForModelLog(text, 100)
      expect(result).toBe(text)
    })
  })

  describe('parseModelApiRequestParams', () => {
    it('parses op and projectId from JSON', () => {
      const params = JSON.stringify({ op: 'test_operation', projectId: 'proj-123' })
      const result = parseModelApiRequestParams(params)
      expect(result).toEqual({ op: 'test_operation', projectId: 'proj-123' })
    })

    it('returns null for invalid JSON', () => {
      const result = parseModelApiRequestParams('invalid json')
      expect(result).toBeNull()
    })

    it('returns null for null input', () => {
      const result = parseModelApiRequestParams(null)
      expect(result).toBeNull()
    })

    it('returns null for empty string', () => {
      const result = parseModelApiRequestParams('')
      expect(result).toBeNull()
    })

    it('returns null for whitespace only', () => {
      const result = parseModelApiRequestParams('   ')
      expect(result).toBeNull()
    })

    it('extracts only op and projectId fields', () => {
      const params = JSON.stringify({
        op: 'write_script',
        projectId: 'proj-456',
        model: 'gpt-4',
        temperature: 0.7
      })
      const result = parseModelApiRequestParams(params)
      expect(result).toEqual({ op: 'write_script', projectId: 'proj-456' })
    })

    it('returns undefined for missing fields', () => {
      const params = JSON.stringify({ other: 'value' })
      const result = parseModelApiRequestParams(params)
      expect(result?.op).toBeUndefined()
      expect(result?.projectId).toBeUndefined()
    })

    it('ignores non-string values', () => {
      const params = JSON.stringify({ op: 123, projectId: 456 })
      const result = parseModelApiRequestParams(params)
      expect(result?.op).toBeUndefined()
      expect(result?.projectId).toBeUndefined()
    })
  })
})
