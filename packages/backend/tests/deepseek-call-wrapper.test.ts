import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock environment variables
process.env.DEEPSEEK_API_KEY = 'test-api-key'
process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

// Suppress unhandled rejection warnings from async timer tests
process.on('unhandledRejection', () => {
  // Ignore - these are from async tests with fake timers
})

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}))

// Mock logDeepSeekChat
vi.mock('../src/services/ai/model-call-log.js', () => ({
  logDeepSeekChat: vi.fn().mockResolvedValue(undefined)
}))

// Mock calculateDeepSeekCost
vi.mock('../src/services/ai/deepseek-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/ai/deepseek-client.js')>()
  return {
    ...actual,
    calculateDeepSeekCost: vi.fn().mockReturnValue({
      costCNY: 0.05,
      promptCost: 0.01,
      completionCost: 0.04
    }),
    DeepSeekAuthError: class DeepSeekAuthError extends Error {
      constructor() {
        super('DeepSeek authentication error')
        this.name = 'DeepSeekAuthError'
      }
    },
    DeepSeekRateLimitError: class DeepSeekRateLimitError extends Error {
      constructor() {
        super('DeepSeek rate limit error')
        this.name = 'DeepSeekRateLimitError'
      }
    }
  }
})

import {
  callDeepSeekWithRetry,
  cleanMarkdownCodeBlocks,
  parseJsonResponse,
  type DeepSeekCallOptions
} from '../src/services/ai/deepseek-call-wrapper.js'
import { DeepSeekAuthError, DeepSeekRateLimitError } from '../src/services/ai/deepseek-client.js'
import { logDeepSeekChat } from '../src/services/ai/model-call-log.js'
import OpenAI from 'openai'

describe('DeepSeek Call Wrapper', () => {
  let mockClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockClient = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('callDeepSeekWithRetry', () => {
    it('should successfully call API and return parsed result on first attempt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"result": "success"}'
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Hello',
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 4000
      }

      const result = await callDeepSeekWithRetry(options, JSON.parse)

      expect(result.content).toEqual({ result: 'success' })
      expect(result.cost).toEqual({ costCNY: 0.05, promptCost: 0.01, completionCost: 0.04 })
      expect(result.rawResponse).toEqual(mockResponse)
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1)
      expect(logDeepSeekChat).toHaveBeenCalledWith(
        undefined,
        'Hello',
        {
          status: 'completed',
          costCNY: 0.05,
          rawContent: '{"result": "success"}'
        },
        {
          systemMessage: 'You are a helpful assistant',
          responseMetadata: {
            model: undefined,
            usage: {
              prompt_tokens: 100,
              completion_tokens: 200,
              total_tokens: 300
            },
            finishReason: undefined,
            contentLength: 21
          }
        }
      )
    })

    it('should use default values when options are not provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"data": "test"}'
            }
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150
        }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt'
      }

      await callDeepSeekWithRetry(options, JSON.parse)

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User prompt' }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    })

    it('should retry on general error and succeed', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"success": true}'
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      // First call fails, second call succeeds
      mockClient.chat.completions.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 2
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)

      // Fast-forward through the sleep
      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise

      expect(result.content).toEqual({ success: true })
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2)
    })

    it('should throw DeepSeekAuthError immediately on 401 error without retry', async () => {
      const authError: any = new Error('Authentication failed')
      authError.status = 401

      mockClient.chat.completions.create.mockRejectedValue(authError)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 3
      }

      try {
        await callDeepSeekWithRetry(options, JSON.parse)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DeepSeekAuthError)
      }

      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1)
      expect(logDeepSeekChat).toHaveBeenCalledWith(
        undefined,
        'Test',
        {
          status: 'failed',
          errorMsg: 'Authentication failed',
          rawContent: undefined
        },
        {
          systemMessage: 'System',
          responseMetadata: {
            errorStatus: 401,
            errorType: 'Error',
            attempt: 1
          }
        }
      )
    })

    it('should throw DeepSeekAuthError immediately on 403 error without retry', async () => {
      const authError: any = new Error('Forbidden')
      authError.status = 403

      mockClient.chat.completions.create.mockRejectedValue(authError)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 3
      }

      try {
        await callDeepSeekWithRetry(options, JSON.parse)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DeepSeekAuthError)
      }

      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1)
    })

    it('should retry on rate limit error (429) and succeed', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"data": "after retry"}'
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      const rateLimitError: any = new Error('Rate limit exceeded')
      rateLimitError.status = 429

      mockClient.chat.completions.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockResponse)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 2
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)

      // Fast-forward through the sleep (2000 * 1)
      await vi.advanceTimersByTimeAsync(2000)

      const result = await promise

      expect(result.content).toEqual({ data: 'after retry' })
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2)
    })

    it('should throw DeepSeekRateLimitError after all retries exhausted on 429', async () => {
      const rateLimitError: any = new Error('rate_limit')
      rateLimitError.status = 429

      mockClient.chat.completions.create.mockRejectedValue(rateLimitError)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 2
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)
      // Set up assertion BEFORE advancing timers
      const assertion = expect(promise).rejects.toBeInstanceOf(DeepSeekRateLimitError)

      // Fast-forward through all retries
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      await assertion

      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2)
      expect(logDeepSeekChat).toHaveBeenCalledWith(
        undefined,
        'Test',
        {
          status: 'failed',
          errorMsg: 'rate_limit',
          rawContent: undefined
        },
        {
          systemMessage: 'System',
          responseMetadata: {
            errorStatus: 429,
            errorType: 'Error',
            attempts: 2
          }
        }
      )
    })

    it('should handle rate limit error with message containing rate_limit', async () => {
      const rateLimitError: any = new Error('Error: rate_limit exceeded')
      rateLimitError.status = 500

      mockClient.chat.completions.create.mockRejectedValue(rateLimitError)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 2
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)
      const assertion = expect(promise).rejects.toBeInstanceOf(DeepSeekRateLimitError)

      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      await assertion
    })

    it('should throw error when API returns empty content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 2
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)
      const assertion = expect(promise).rejects.toThrow('DeepSeek API 返回为空')

      await vi.advanceTimersByTimeAsync(1000)

      await assertion
    })

    it('should pass modelLog context to logDeepSeekChat', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"test": true}'
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const modelLog = {
        userId: 'user-123',
        projectId: 'project-456',
        op: 'test-operation'
      }

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        modelLog
      }

      await callDeepSeekWithRetry(options, JSON.parse)

      expect(logDeepSeekChat).toHaveBeenCalledWith(
        modelLog,
        'Test',
        {
          status: 'completed',
          costCNY: 0.05,
          rawContent: '{"test": true}'
        },
        {
          systemMessage: 'System',
          responseMetadata: {
            model: undefined,
            usage: {
              prompt_tokens: 100,
              completion_tokens: 200,
              total_tokens: 300
            },
            finishReason: undefined,
            contentLength: 14
          }
        }
      )
    })

    it('should retry with custom maxRetries', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"retry": 3}'
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      mockClient.chat.completions.create
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(mockResponse)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 3
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)
      // 推进fake timers以触发重试
      await vi.advanceTimersByTimeAsync(3000)
      const result = await promise

      expect(result.content).toEqual({ retry: 3 })
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(3)
    }, 10000) // 增加超时时间到10秒

    it('should throw last error after all retries exhausted', async () => {
      const networkError = new Error('Network timeout')

      mockClient.chat.completions.create.mockRejectedValue(networkError)

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test',
        maxRetries: 2
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)
      const assertion = expect(promise).rejects.toThrow('Network timeout')

      await vi.advanceTimersByTimeAsync(1000)

      await assertion

      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2)
    })

    it('should log failed status when all retries exhausted', async () => {
      const networkError = new Error('Connection refused')

      mockClient.chat.completions.create.mockRejectedValue(networkError)

      const modelLog = {
        userId: 'user-123',
        op: 'test'
      }

      const options: DeepSeekCallOptions = {
        client: mockClient,
        systemPrompt: 'System',
        userPrompt: 'Test prompt',
        modelLog,
        maxRetries: 2
      }

      const promise = callDeepSeekWithRetry(options, JSON.parse)
      const assertion = expect(promise).rejects.toThrow('Connection refused')

      await vi.advanceTimersByTimeAsync(1000)

      await assertion

      expect(logDeepSeekChat).toHaveBeenCalledWith(
        modelLog,
        'Test prompt',
        {
          status: 'failed',
          errorMsg: 'Connection refused',
          rawContent: undefined
        },
        {
          systemMessage: 'System',
          responseMetadata: {
            error: 'Connection refused',
            errorStack: expect.any(String),
            errorType: 'Error',
            errorStatus: undefined,
            attempts: 2
          }
        }
      )
    })
  })

  describe('cleanMarkdownCodeBlocks', () => {
    it('should remove ```json code blocks', () => {
      const input = '```json\n{"key": "value"}\n```'
      const expected = '{"key": "value"}'

      expect(cleanMarkdownCodeBlocks(input)).toBe(expected)
    })

    it('should remove ``` code blocks without json specifier', () => {
      const input = '```\n{"key": "value"}\n```'
      const expected = '{"key": "value"}'

      expect(cleanMarkdownCodeBlocks(input)).toBe(expected)
    })

    it('should handle code blocks without trailing newline', () => {
      const input = '```json\n{"key": "value"}\n```'
      const expected = '{"key": "value"}'

      expect(cleanMarkdownCodeBlocks(input)).toBe(expected)
    })

    it('should return original content if no code blocks', () => {
      const input = '{"key": "value"}'

      expect(cleanMarkdownCodeBlocks(input)).toBe(input)
    })

    it('should trim whitespace after removing code blocks', () => {
      const input = '  ```json\n{"key": "value"}\n```  '
      const expected = '{"key": "value"}'

      expect(cleanMarkdownCodeBlocks(input)).toBe(expected)
    })

    it('should handle multiple code block markers', () => {
      const input = '```json\n{"a": 1}\n```\n```json\n{"b": 2}\n```'
      const expected = '{"a": 1}\n{"b": 2}'

      expect(cleanMarkdownCodeBlocks(input)).toBe(expected)
    })
  })

  describe('parseJsonResponse', () => {
    it('should parse valid JSON string', () => {
      const input = '{"name": "test", "value": 123}'
      const result = parseJsonResponse(input)

      expect(result).toEqual({ name: 'test', value: 123 })
    })

    it('should clean markdown by default', () => {
      const input = '```json\n{"cleaned": true}\n```'
      const result = parseJsonResponse(input)

      expect(result).toEqual({ cleaned: true })
    })

    it('should skip markdown cleaning when cleanMarkdown is false', () => {
      const input = '{"raw": true}'

      expect(() => parseJsonResponse(input, false)).not.toThrow()
      expect(parseJsonResponse(input, false)).toEqual({ raw: true })
    })

    it('should throw error on invalid JSON', () => {
      const input = 'not valid json'

      expect(() => parseJsonResponse(input)).toThrow(SyntaxError)
    })

    it('should support generic type parameter', () => {
      interface TestType {
        id: number
        name: string
      }

      const input = '{"id": 1, "name": "test"}'
      const result = parseJsonResponse<TestType>(input)

      expect(result.id).toBe(1)
      expect(result.name).toBe('test')
    })
  })
})
