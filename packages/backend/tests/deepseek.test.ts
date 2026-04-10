import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock environment variables
process.env.DEEPSEEK_API_KEY = 'test-api-key'
process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import after mocks
import {
  DeepSeekAuthError,
  DeepSeekRateLimitError,
  calculateDeepSeekCost,
  getDeepSeekBalance,
  convertDeepSeekResponse,
  expandScript,
  optimizePrompt,
  type DeepSeekBalance
} from '../src/services/deepseek.js'

// Mock OpenAI client
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}))

describe('DeepSeek Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateDeepSeekCost', () => {
    it('should calculate cost correctly', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500
      }

      const cost = calculateDeepSeekCost(usage)

      expect(cost.inputTokens).toBe(1000)
      expect(cost.outputTokens).toBe(500)
      expect(cost.totalTokens).toBe(1500)
      expect(cost.costUSD).toBeCloseTo(0.00027 + 0.000535) // 0.27 + 1.07 per 1M
      expect(cost.costCNY).toBeCloseTo(cost.costUSD * 7.2)
    })

    it('should handle missing usage data', () => {
      const cost = calculateDeepSeekCost({})

      expect(cost.inputTokens).toBe(0)
      expect(cost.outputTokens).toBe(0)
      expect(cost.totalTokens).toBe(0)
      expect(cost.costUSD).toBe(0)
    })
  })

  describe('getDeepSeekBalance', () => {
    it('should return balance info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          is_available: true,
          balance_infos: [
            {
              currency: 'CNY',
              total_balance: '10.50',
              granted_balance: '5.00',
              topped_up_balance: '5.50'
            }
          ]
        })
      })

      const balance: DeepSeekBalance = await getDeepSeekBalance()

      expect(balance.isAvailable).toBe(true)
      expect(balance.balanceInfos.length).toBe(1)
      expect(balance.balanceInfos[0].currency).toBe('CNY')
      expect(balance.balanceInfos[0].totalBalance).toBe(10.50)
    })

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      })

      await expect(getDeepSeekBalance()).rejects.toThrow('Failed to get DeepSeek balance')
    })
  })

  describe('convertDeepSeekResponse', () => {
    it('should convert standard format', () => {
      const data = {
        title: 'Test Episode',
        summary: 'A test summary',
        scenes: [
          {
            sceneNum: 1,
            location: 'indoor',
            timeOfDay: 'day',
            characters: ['Alice', 'Bob'],
            description: 'Test scene',
            dialogues: [
              { character: 'Alice', content: 'Hello' }
            ],
            actions: ['Action 1', 'Action 2']
          }
        ]
      }

      const script = convertDeepSeekResponse(data)

      expect(script.title).toBe('Test Episode')
      expect(script.summary).toBe('A test summary')
      expect(script.scenes.length).toBe(1)
      expect(script.scenes[0].location).toBe('indoor')
      expect(script.scenes[0].dialogues[0].character).toBe('Alice')
    })

    it('should convert nested episodes format', () => {
      const data = {
        title: 'Main Title',
        episodes: [
          {
            title: 'Episode 1',
            scenes: [
              {
                sceneNum: 1,
                location: 'outdoor',
                timeOfDay: 'night',
                dialogues: [],
                actions: []
              }
            ]
          }
        ]
      }

      const script = convertDeepSeekResponse(data)

      expect(script.scenes.length).toBe(1)
      expect(script.scenes[0].location).toBe('outdoor')
    })

    it('should handle dialogue as object format', () => {
      const data = {
        title: 'Test',
        scenes: [
          {
            sceneNum: 1,
            dialogue: { Alice: 'Hello Bob', Bob: 'Hi Alice' }, // Note: 'dialogue' not 'dialogues'
            action: 'Single action' // Note: 'action' not 'actions'
          }
        ]
      }

      const script = convertDeepSeekResponse(data)

      expect(script.scenes[0].dialogues.length).toBe(2)
      expect(script.scenes[0].dialogues[0]).toEqual({ character: 'Alice', content: 'Hello Bob' })
      expect(script.scenes[0].actions.length).toBe(1)
    })
  })

  describe('DeepSeekAuthError', () => {
    it('should have correct name and message', () => {
      const error = new DeepSeekAuthError()

      expect(error.name).toBe('DeepSeekAuthError')
      expect(error.message).toContain('认证失败')
    })

    it('should accept custom message', () => {
      const error = new DeepSeekAuthError('Custom message')

      expect(error.message).toBe('Custom message')
    })
  })

  describe('DeepSeekRateLimitError', () => {
    it('should have correct name and message', () => {
      const error = new DeepSeekRateLimitError()

      expect(error.name).toBe('DeepSeekRateLimitError')
      expect(error.message).toContain('频繁')
    })

    it('should accept custom message', () => {
      const error = new DeepSeekRateLimitError('Custom rate limit message')

      expect(error.message).toBe('Custom rate limit message')
    })
  })
})
