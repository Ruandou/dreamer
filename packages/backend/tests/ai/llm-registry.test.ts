import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  llmRegistry,
  registerLLMProvider,
  createLLMProvider,
  listLLMProviders,
  hasLLMProvider
} from '../../src/services/ai/llm-registry.js'
import type {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletion,
  LLMMessage
} from '../../src/services/ai/llm-provider.js'

// Import llm-factory to trigger DeepSeek provider registration
import '../../src/services/ai/llm-factory.js'

describe('LLMProviderRegistry', () => {
  // 使用唯一的 provider 名称避免测试间干扰
  const testProviderName = 'test-provider-' + Date.now()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    it('should register a provider factory', () => {
      const initialSize = llmRegistry.size
      const mockFactory = vi.fn().mockReturnValue({
        name: testProviderName,
        complete: vi.fn(),
        getConfig: vi.fn()
      } as LLMProvider)

      registerLLMProvider(testProviderName, mockFactory)

      expect(llmRegistry.size).toBe(initialSize + 1)
      expect(llmRegistry.hasProvider(testProviderName)).toBe(true)
    })

    it('should register provider case-insensitively', () => {
      const mockFactory = vi.fn().mockReturnValue({
        name: 'TestProvider',
        complete: vi.fn(),
        getConfig: vi.fn()
      } as LLMProvider)

      registerLLMProvider('TESTPROVIDER', mockFactory)
      expect(llmRegistry.hasProvider('testprovider')).toBe(true)
      expect(llmRegistry.hasProvider('TESTPROVIDER')).toBe(true)
      expect(llmRegistry.hasProvider('TestProvider')).toBe(true)
    })
  })

  describe('create', () => {
    it('should create provider using registered factory', () => {
      const providerName = testProviderName + '-create'
      const config: LLMProviderConfig = {
        provider: providerName,
        apiKey: 'test-key'
      }

      const mockProvider = {
        name: providerName,
        complete: vi.fn(),
        getConfig: vi.fn().mockReturnValue(config)
      } as LLMProvider

      const mockFactory = vi.fn().mockReturnValue(mockProvider)
      registerLLMProvider(providerName, mockFactory)

      const provider = createLLMProvider(config)

      expect(provider).toBe(mockProvider)
      expect(mockFactory).toHaveBeenCalledWith(config)
    })

    it('should throw error for unregistered provider', () => {
      expect(() =>
        createLLMProvider({
          provider: 'nonexistent-provider',
          apiKey: 'test-key'
        })
      ).toThrow(/Unknown LLM provider: nonexistent-provider/)
    })

    it('should include available providers in error message', () => {
      // Register a known provider
      registerLLMProvider(
        'known-provider',
        vi.fn().mockReturnValue({
          name: 'known',
          complete: vi.fn(),
          getConfig: vi.fn()
        } as LLMProvider)
      )

      try {
        createLLMProvider({
          provider: 'unknown-provider',
          apiKey: 'test-key'
        })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        const errorMessage = (error as Error).message
        expect(errorMessage).toContain('known-provider')
      }
    })
  })

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      const name = 'check-provider-' + Date.now()
      registerLLMProvider(
        name,
        vi.fn().mockReturnValue({
          name,
          complete: vi.fn(),
          getConfig: vi.fn()
        } as LLMProvider)
      )

      expect(hasLLMProvider(name)).toBe(true)
    })

    it('should return false for unregistered provider', () => {
      expect(hasLLMProvider('definitely-not-registered')).toBe(false)
    })

    it('should be case-insensitive', () => {
      const name = 'case-test-' + Date.now()
      registerLLMProvider(name, vi.fn())

      expect(hasLLMProvider(name.toUpperCase())).toBe(true)
      expect(hasLLMProvider(name.toLowerCase())).toBe(true)
    })
  })

  describe('listProviders', () => {
    it('should return list of registered provider names', () => {
      const name1 = 'list-test-1-' + Date.now()
      const name2 = 'list-test-2-' + Date.now()

      registerLLMProvider(name1, vi.fn())
      registerLLMProvider(name2, vi.fn())

      const providers = listLLMProviders()

      expect(providers).toContain(name1)
      expect(providers).toContain(name2)
    })

    it('should return lowercase names', () => {
      const name = 'MIXED-CASE-' + Date.now()
      registerLLMProvider(name, vi.fn())

      const providers = listLLMProviders()
      expect(providers).toContain(name.toLowerCase())
    })
  })

  describe('integration', () => {
    it('should work with real DeepSeek provider registration', () => {
      // DeepSeek should be registered by llm-factory.ts
      expect(hasLLMProvider('deepseek')).toBe(true)

      const providers = listLLMProviders()
      expect(providers).toContain('deepseek')
    })

    it('should create DeepSeek provider successfully', () => {
      // This tests the full integration
      const provider = createLLMProvider({
        provider: 'deepseek',
        apiKey: 'test-api-key'
      })

      expect(provider).toBeDefined()
      expect(provider.name).toBe('deepseek')
    })
  })
})

describe('LLMProvider (DeepSeek integration)', () => {
  it('should complete a simple chat request', async () => {
    // This is more of an integration test - would need actual API key
    // Skipping for unit test, but shows the pattern
    const provider = createLLMProvider({
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY || 'skip-test'
    })

    if (!process.env.DEEPSEEK_API_KEY) {
      console.log('Skipping integration test - no DEEPSEEK_API_KEY')
      return
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello!' }
    ]

    const result = await provider.complete(messages, {
      model: 'deepseek-chat',
      maxTokens: 50
    })

    expect(result.content).toBeDefined()
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.usage.totalTokens).toBeGreaterThan(0)
    expect(result.model).toBe('deepseek-chat')
  })
})
