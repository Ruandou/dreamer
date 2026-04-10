import { describe, it, expect, vi, beforeEach } from 'vitest'
import { expandScript, optimizePrompt, getDeepSeekBalance, DeepSeekAuthError, DeepSeekRateLimitError } from '../src/services/deepseek.js'

// Mock the OpenAI client
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}))

// Mock environment variables
const originalEnv = process.env

beforeEach(() => {
  vi.clearAllMocks()
  process.env = {
    ...originalEnv,
    DEEPSEEK_API_KEY: 'test-api-key',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1'
  }
})

describe('DeepSeek Service', () => {
  describe('getDeepSeekBalance', () => {
    it('should return balance info when API returns success', async () => {
      const mockResponse = {
        is_available: true,
        balance_infos: [
          {
            currency: 'CNY',
            total_balance: '10.50',
            granted_balance: '5.00',
            topped_up_balance: '5.50'
          }
        ]
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await getDeepSeekBalance()

      expect(result.isAvailable).toBe(true)
      expect(result.balanceInfos).toHaveLength(1)
      expect(result.balanceInfos[0].currency).toBe('CNY')
      expect(result.balanceInfos[0].totalBalance).toBe(10.50)
      expect(result.balanceInfos[0].grantedBalance).toBe(5.00)
      expect(result.balanceInfos[0].toppedUpBalance).toBe(5.50)
    })

    it('should throw error when API returns failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized'
      })

      await expect(getDeepSeekBalance()).rejects.toThrow('Failed to get DeepSeek balance')
    })
  })

  describe('expandScript', () => {
    it('should return expanded script with valid JSON response', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: '{"title":"测试剧本","summary":"测试摘要","scenes":[{"sceneNum":1,"location":"室内","timeOfDay":"日","characters":["角色1"],"description":"测试场景","dialogues":[{"character":"角色1","content":"测试对话"}],"actions":["动作1"]}]}'
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      vi.mocked(global.fetch).mockReset()
      const { default: OpenAI } = await import('openai')
      const mockCreate = vi.fn().mockResolvedValue(mockCompletion)
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const result = await expandScript('测试梗概')

      expect(result.script.title).toBe('测试剧本')
      expect(result.script.scenes).toHaveLength(1)
      expect(result.script.scenes[0].location).toBe('室内')
      expect(result.cost.inputTokens).toBe(100)
      expect(result.cost.outputTokens).toBe(200)
      expect(result.cost.totalTokens).toBe(300)
    })

    it('should handle markdown code blocks in response', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: '```json\n{"title":"测试剧本","summary":"测试摘要","scenes":[]}\n```'
          }
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100,
          total_tokens: 150
        }
      }

      global.fetch = vi.fn()
      const { default: OpenAI } = await import('openai')
      const mockCreate = vi.fn().mockResolvedValue(mockCompletion)
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const result = await expandScript('测试梗概')

      expect(result.script.title).toBe('测试剧本')
    })

    it('should throw DeepSeekAuthError on 401/403', async () => {
      const authError = { status: 401, message: 'Unauthorized' }
      global.fetch = vi.fn()
      const { default: OpenAI } = await import('openai')
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(authError)
          }
        }
      }))

      await expect(expandScript('测试梗概')).rejects.toThrow(DeepSeekAuthError)
    })

    it('should throw DeepSeekRateLimitError on 429', async () => {
      const rateLimitError = { status: 429, message: 'Rate limit exceeded' }
      global.fetch = vi.fn()
      const { default: OpenAI } = await import('openai')
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(rateLimitError)
          }
        }
      }))

      await expect(expandScript('测试梗概')).rejects.toThrow(DeepSeekRateLimitError)
    })
  })

  describe('optimizePrompt', () => {
    it('should return optimized prompt', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: '优化后的提示词文本'
          }
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 50,
          total_tokens: 100
        }
      }

      global.fetch = vi.fn()
      const { default: OpenAI } = await import('openai')
      const mockCreate = vi.fn().mockResolvedValue(mockCompletion)
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const result = await optimizePrompt('原始提示词')

      expect(result.optimized).toBe('优化后的提示词文本')
      expect(result.cost.totalTokens).toBe(100)
    })

    it('should include context when provided', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: '带上下文的优化结果'
          }
        }],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 40,
          total_tokens: 120
        }
      }

      global.fetch = vi.fn()
      const { default: OpenAI } = await import('openai')
      const mockCreate = vi.fn().mockResolvedValue(mockCompletion)
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const result = await optimizePrompt('原始提示词', '项目上下文')

      expect(result.optimized).toBe('带上下文的优化结果')
    })
  })
})
