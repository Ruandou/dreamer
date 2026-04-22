import { describe, it, expect } from 'vitest'
import {
  createLLMProvider,
  getDefaultProvider,
  createDeepSeekProvider
} from '../src/services/ai/llm-factory.js'

describe('llm-factory', () => {
  describe('createLLMProvider', () => {
    it('creates DeepSeek provider', () => {
      const provider = createLLMProvider({
        provider: 'deepseek',
        apiKey: 'test-key'
      })
      expect(provider.name).toBe('deepseek')
    })

    it('throws for OpenAI provider (not registered)', () => {
      expect(() =>
        createLLMProvider({
          provider: 'openai',
          apiKey: 'test-key'
        })
      ).toThrow(/Unknown LLM provider: openai/)
    })

    it('throws for Claude provider (not registered)', () => {
      expect(() =>
        createLLMProvider({
          provider: 'claude',
          apiKey: 'test-key'
        })
      ).toThrow(/Unknown LLM provider: claude/)
    })

    it('throws for unsupported provider', () => {
      expect(() =>
        createLLMProvider({
          provider: 'unknown',
          apiKey: 'test-key'
        })
      ).toThrow(/Unknown LLM provider: unknown/)
    })
  })

  describe('getDefaultProvider', () => {
    it('returns default provider when API key is set', () => {
      process.env.DEEPSEEK_API_KEY = 'test-key'
      const provider = getDefaultProvider()
      expect(provider.name).toBe('deepseek')
    })

    it('throws when API key is missing', () => {
      const originalKey = process.env.DEEPSEEK_API_KEY
      delete process.env.DEEPSEEK_API_KEY
      expect(() => getDefaultProvider()).toThrow('DEEPSEEK_API_KEY')
      process.env.DEEPSEEK_API_KEY = originalKey
    })
  })

  describe('createDeepSeekProvider', () => {
    it('creates provider with explicit API key', () => {
      const provider = createDeepSeekProvider('explicit-key')
      expect(provider.name).toBe('deepseek')
    })

    it('falls back to environment variable', () => {
      process.env.DEEPSEEK_API_KEY = 'env-key'
      const provider = createDeepSeekProvider()
      expect(provider.name).toBe('deepseek')
    })
  })
})
