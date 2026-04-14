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

  describe('convertDeepSeekResponse', () => {
    it('uses nested episodes[0].scenes when top-level scenes missing', () => {
      const c = convertDeepSeekResponse({
        episode_title: 'E1',
        episodes: [
          {
            scenes: [
              {
                sceneNum: 2,
                location: '酒吧',
                timeOfDay: '夜',
                characters: [],
                description: '内景',
                dialogues: [{ character: 'A', content: '喝' }],
                actions: ['举杯']
              }
            ]
          }
        ]
      })
      expect(c.scenes).toHaveLength(1)
      expect(c.scenes[0].location).toBe('酒吧')
    })

    it('maps dialogue record to dialogue lines', () => {
      const c = convertDeepSeekResponse({
        title: 'X',
        scenes: [
          {
            dialogue: { 老师: '上课', 学生: '好' }
          }
        ]
      })
      expect(c.scenes[0].dialogues.map((d) => d.character).sort()).toEqual(['学生', '老师'])
    })

    it('splits single action string by sentence boundaries', () => {
      const c = convertDeepSeekResponse({
        title: 'Y',
        scenes: [
          {
            action: '走出房间。转身!',
            characters: [],
            description: '走廊'
          }
        ]
      })
      expect(c.scenes[0].actions.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('generateCharacterSlotImagePrompt', () => {
    it('returns trimmed prompt and cost', async () => {
      const { generateCharacterSlotImagePrompt } = await import('../src/services/deepseek.js')
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '"正面半身肖像，柔和布光，写实"' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })
      const r = await generateCharacterSlotImagePrompt({
        characterName: '李明',
        characterDescription: '三十岁业务员',
        slotName: '正式谈判',
        slotType: 'outfit',
        slotDescription: '西装',
        parentSlotSummary: '与基础定妆一致'
      })
      expect(r.prompt.length).toBeGreaterThan(5)
      expect(r.cost.totalTokens).toBe(30)
      const call = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0]
      expect(call.messages[0].content).toMatch(/换装/)
      expect(call.messages[1].content as string).toMatch(/保持该角色面部特征/)
    })

    it('uses base slot system prompt with 七分身 for base type', async () => {
      const { generateCharacterSlotImagePrompt } = await import('../src/services/deepseek.js')
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '七分身，中灰背景，写实' } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      })
      await generateCharacterSlotImagePrompt({
        characterName: '王芳',
        characterDescription: '记者',
        slotName: '基础形象',
        slotType: 'base',
        slotDescription: '',
        parentSlotSummary: null
      })
      const call = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0]
      expect(call.messages[0].content as string).toMatch(/七分身/)
      expect(call.messages[1].content as string).toMatch(/纯色影棚/)
    })
  })

  describe('fetchScriptVisualEnrichmentJson', () => {
    it('returns jsonText from model', async () => {
      const { fetchScriptVisualEnrichmentJson } = await import('../src/services/deepseek.js')
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"locations":[],"characters":[]}' } }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
      })
      const r = await fetchScriptVisualEnrichmentJson({
        scriptSummary: '都市爱情故事梗概',
        locationLines: '咖啡馆 | 时间：日 | 描述：内景',
        characterLines: '主角 | 女',
        projectVisualStyleLine: '真人写实、暖色'
      })
      expect(r.jsonText).toContain('locations')
      expect(r.cost.costCNY).toBeGreaterThanOrEqual(0)
    })

    it('sends short system prompt and user content with location rules and visual style', async () => {
      const {
        fetchScriptVisualEnrichmentJson,
        buildScriptVisualEnrichmentUserContent,
        SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT,
        SCRIPT_VISUAL_ENRICH_LOCATION_RULES_IN_USER
      } = await import('../src/services/deepseek.js')
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      })
      await fetchScriptVisualEnrichmentJson({
        scriptSummary: '梗概',
        locationLines: '书店 | 时间：晨 | 描述：杂乱',
        characterLines: '无',
        projectVisualStyleLine: '复古胶片'
      })
      const call = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0]
      expect(call.messages[0].content).toBe(SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT)
      expect(call.messages[0].content).not.toMatch(/绝对禁止/)
      const user = call.messages[1].content as string
      expect(user).toContain(SCRIPT_VISUAL_ENRICH_LOCATION_RULES_IN_USER)
      expect(user).toMatch(/绝对禁止在 imagePrompt 中出现任何人物/)
      expect(user).toContain('复古胶片')
      expect(user).toContain('场地（每行：名称 | 时间：… | 描述：…）')
      const built = buildScriptVisualEnrichmentUserContent({
        scriptSummary: 'S',
        locationLines: 'L',
        characterLines: 'C',
        projectVisualStyleLine: '水墨',
        exactLocationNames: ['咖啡馆A', '天台']
      })
      expect(built).toContain('水墨')
      expect(built).toContain('【项目视觉风格】')
      expect(built).toContain('【定场图 imagePrompt】')
      expect(built).toContain('【场地名白名单】')
      expect(built).toContain('- 咖啡馆A')
      expect(built).toContain('- 天台')
      expect(built).toMatch(/七分身/)
      expect(built).toMatch(/纯色影棚/)
      expect(built).toMatch(/保持该角色面部特征/)
    })
  })
})
