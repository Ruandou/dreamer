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
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn()
}))

vi.mock('../src/services/model-call-log.js', () => ({
  logDeepSeekChat: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
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
      // 新定价：输入2元/百万tokens，输出3元/百万tokens
      // 1000 tokens = 0.001百万tokens，500 tokens = 0.0005百万tokens
      // 成本 = (0.001 * 2) + (0.0005 * 3) = 0.002 + 0.0015 = 0.0035元
      expect(cost.costCNY).toBeCloseTo(0.0035, 4)
    })

    it('should handle missing usage data', () => {
      const cost = calculateDeepSeekCost({})

      expect(cost.inputTokens).toBe(0)
      expect(cost.outputTokens).toBe(0)
      expect(cost.totalTokens).toBe(0)
      expect(cost.costCNY).toBe(0)
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

  describe('expandScript', () => {
    it('should expand script with project context', async () => {
      const { expandScript } = await import('../src/services/deepseek.js')

      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Expanded Script',
              summary: 'A great story',
              scenes: [{
                sceneNum: 1,
                location: 'indoor',
                timeOfDay: 'day',
                description: 'Scene description',
                dialogues: [],
                actions: []
              }]
            })
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
      })

      const result = await expandScript('A story', 'Test Project')

      expect(result.script.title).toBe('Expanded Script')
      expect(result.cost.inputTokens).toBe(100)
    })

    it('should expand script without project context', async () => {
      const { expandScript } = await import('../src/services/deepseek.js')

      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Expanded Script',
              summary: 'A great story',
              scenes: [{
                sceneNum: 1,
                location: 'outdoor',
                timeOfDay: 'night',
                description: 'Scene description',
                dialogues: [],
                actions: []
              }]
            })
          }
        }],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 }
      })

      const result = await expandScript('A story')

      expect(result.script.title).toBe('Expanded Script')
    })

    it('should throw DeepSeekAuthError on 401', async () => {
      const { expandScript } = await import('../src/services/deepseek.js')

      const authError = new Error('Unauthorized')
      authError.status = 401
      mockCreate.mockRejectedValueOnce(authError)

      await expect(expandScript('A story')).rejects.toThrow(DeepSeekAuthError)
    })

    it('should throw error on API failure', async () => {
      const { expandScript } = await import('../src/services/deepseek.js')

      mockCreate.mockRejectedValueOnce(new Error('API Error'))

      await expect(expandScript('A story')).rejects.toThrow()
    })
  })

  describe('optimizePrompt', () => {
    it('should optimize prompt with context', async () => {
      const { optimizePrompt } = await import('../src/services/deepseek.js')

      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Optimized: A beautiful sunset over the ocean, golden hour lighting, cinematic wide shot'
          }
        }],
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
      })

      const result = await optimizePrompt('A sunset', 'Ocean scene')

      expect(result.optimized).toContain('Optimized')
      expect(result.cost.inputTokens).toBe(50)
    })

    it('should optimize prompt without context', async () => {
      const { optimizePrompt } = await import('../src/services/deepseek.js')

      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Optimized: A person walking in the park, sunny day, tracking shot'
          }
        }],
        usage: { prompt_tokens: 20, completion_tokens: 25, total_tokens: 45 }
      })

      const result = await optimizePrompt('A person walking')

      expect(result.optimized).toContain('Optimized')
    })

    it('should throw DeepSeekAuthError on 401', async () => {
      const { optimizePrompt } = await import('../src/services/deepseek.js')

      const authError = new Error('Unauthorized')
      authError.status = 401
      mockCreate.mockRejectedValueOnce(authError)

      await expect(optimizePrompt('A prompt')).rejects.toThrow(DeepSeekAuthError)
    })
  })
})
