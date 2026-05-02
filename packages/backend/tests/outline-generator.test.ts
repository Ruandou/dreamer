import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCallLLMWithRetry = vi.fn()
const mockParseJsonResponse = vi.fn()
const mockRepairJsonWithAI = vi.fn()
const mockGetDefaultProvider = vi.fn()
const mockLogInfo = vi.fn()
const mockLogWarning = vi.fn()
const mockLogError = vi.fn()

vi.mock('../src/services/ai/llm/llm-call-wrapper.js', () => ({
  callLLMWithRetry: (...args: unknown[]) => mockCallLLMWithRetry(...args),
  parseJsonResponse: (...args: unknown[]) => mockParseJsonResponse(...args),
  cleanMarkdownCodeBlocks: (content: string) => content
}))

vi.mock('../src/services/ai/json-repair.js', () => ({
  repairJsonWithAI: (...args: unknown[]) => mockRepairJsonWithAI(...args)
}))

vi.mock('../src/services/ai/llm-factory.js', () => ({
  getDefaultProvider: () => mockGetDefaultProvider()
}))

vi.mock('../src/lib/error-logger.js', () => ({
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
  logError: (...args: unknown[]) => mockLogError(...args)
}))

import { generateOutline } from '../src/services/ai/outline-generator.js'

describe('outline-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDefaultProvider.mockReturnValue({
      name: 'test-provider',
      getConfig: () => ({ defaultModel: 'test-model' })
    })
  })

  const baseOptions = {
    templateName: '赘婿逆袭流',
    templateStructure: { acts: [] },
    paywallEpisodes: [10, 20, 30],
    protagonistName: '林凡',
    protagonistIdentity: '隐世家族继承人',
    coreConflict: '身份冲突',
    targetAudience: '下沉市场',
    targetEpisodes: 40,
    userId: 'user-1',
    projectId: 'proj-1'
  }

  function createMockEpisodes(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      episodeNum: i + 1,
      title: `第${i + 1}集标题`,
      synopsis: `第${i + 1}集梗概`,
      hook: `第${i + 1}集钩子`,
      cliffhanger: `第${i + 1}集悬念`,
      isPaywall: [10, 20, 30].includes(i + 1)
    }))
  }

  describe('successful generation', () => {
    it('generates 40 episodes with correct structure', async () => {
      const mockEpisodes = createMockEpisodes(40)
      mockCallLLMWithRetry.mockResolvedValue({
        content: { episodes: mockEpisodes },
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const result = await generateOutline(baseOptions)

      expect(result).toHaveLength(40)
      expect(result[0].episodeNum).toBe(1)
      expect(result[39].episodeNum).toBe(40)
      expect(result[9].isPaywall).toBe(true)
      expect(result[19].isPaywall).toBe(true)
      expect(result[29].isPaywall).toBe(true)
      expect(result[0].isPaywall).toBe(false)
    })

    it('uses few-shot prompt with template structure', async () => {
      mockCallLLMWithRetry.mockResolvedValue({
        content: { episodes: createMockEpisodes(40) },
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      await generateOutline(baseOptions)

      const callArgs = mockCallLLMWithRetry.mock.calls[0][0]
      const prompt = callArgs.messages[0].content

      expect(prompt).toContain('赘婿逆袭流')
      expect(prompt).toContain('林凡')
      expect(prompt).toContain('隐世家族继承人')
      expect(prompt).toContain('示例')
      expect(prompt).toContain('自检指令')
      expect(prompt).toContain('只输出纯 JSON')
    })
  })

  describe('JSON parsing robustness', () => {
    it('handles markdown code blocks in response', async () => {
      mockCallLLMWithRetry.mockImplementation(async (_options, parser) => {
        const content =
          '```json\n{ "episodes": ' + JSON.stringify(createMockEpisodes(40)) + ' }\n```'
        const parsed = await parser(content)
        return {
          content: parsed,
          cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
          rawResponse: {},
          model: 'test-model',
          provider: 'test-provider'
        }
      })

      mockParseJsonResponse.mockImplementation((content: string) => {
        const clean = content
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        return JSON.parse(clean)
      })

      const result = await generateOutline(baseOptions)
      expect(result).toHaveLength(40)
    })

    it('uses AI repair when JSON is malformed', async () => {
      mockCallLLMWithRetry.mockImplementation(async (_options, parser) => {
        const brokenContent = '{ "episodes": [ { "episodeNum": 1, "title": "test", } ] }'
        const parsed = await parser(brokenContent)
        return {
          content: parsed,
          cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
          rawResponse: {},
          model: 'test-model',
          provider: 'test-provider'
        }
      })

      // First call fails, second call (after AI repair) succeeds
      let callCount = 0
      mockParseJsonResponse.mockImplementation((content: string) => {
        callCount++
        if (callCount === 1) {
          throw new Error('JSON parse error')
        }
        // After AI repair, content should be valid
        return JSON.parse(content)
      })

      mockRepairJsonWithAI.mockResolvedValue(
        '{ "episodes": ' + JSON.stringify(createMockEpisodes(40)) + ' }'
      )

      const result = await generateOutline(baseOptions)
      expect(result).toHaveLength(40)
      expect(mockRepairJsonWithAI).toHaveBeenCalled()
    })
  })

  describe('episode count alignment', () => {
    it('fills missing episodes when LLM returns fewer than target', async () => {
      const only30Episodes = createMockEpisodes(30)
      mockCallLLMWithRetry.mockResolvedValue({
        content: { episodes: only30Episodes },
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const result = await generateOutline(baseOptions)

      expect(result).toHaveLength(40)
      // Episodes 31-40 should be filled
      expect(result[30].title).toContain('剧情推进')
      expect(result[30].episodeNum).toBe(31)
      expect(result[39].episodeNum).toBe(40)
    })

    it('truncates excess episodes when LLM returns more than target', async () => {
      const fiftyEpisodes = createMockEpisodes(50)
      mockCallLLMWithRetry.mockResolvedValue({
        content: { episodes: fiftyEpisodes },
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const result = await generateOutline(baseOptions)

      expect(result).toHaveLength(40)
      expect(result[39].episodeNum).toBe(40)
    })

    it('ensures paywall episodes are correctly set after alignment', async () => {
      const only25Episodes = createMockEpisodes(25)
      mockCallLLMWithRetry.mockResolvedValue({
        content: { episodes: only25Episodes },
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const result = await generateOutline(baseOptions)

      expect(result[9].isPaywall).toBe(true) // Episode 10
      expect(result[19].isPaywall).toBe(true) // Episode 20
      expect(result[29].isPaywall).toBe(true) // Episode 30
      expect(result[0].isPaywall).toBe(false) // Episode 1
    })
  })

  describe('episode validation', () => {
    it('fixes episodes with missing fields using defaults', async () => {
      const badEpisodes = [
        {
          episodeNum: 1,
          title: 'Valid',
          synopsis: 'Has all fields',
          hook: 'hook',
          cliffhanger: 'end',
          isPaywall: false
        },
        { episodeNum: 2, title: '', synopsis: 'Missing title', hook: 'hook', cliffhanger: 'end' },
        { episodeNum: 3, title: 'Missing hook', synopsis: 'No hook field', cliffhanger: 'end' }
      ]

      // Fill remaining to 40
      for (let i = 4; i <= 40; i++) {
        badEpisodes.push({
          episodeNum: i,
          title: `第${i}集`,
          synopsis: `第${i}集梗概`,
          hook: `第${i}集钩子`,
          cliffhanger: `第${i}集悬念`,
          isPaywall: [10, 20, 30].includes(i)
        })
      }

      mockCallLLMWithRetry.mockResolvedValue({
        content: { episodes: badEpisodes },
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const result = await generateOutline(baseOptions)

      expect(result).toHaveLength(40)
      // Episode 2 has empty title - should be fixed with fallback
      expect(result[1].title).toBeTruthy()
      // Episode 3 is missing hook field - should be fixed with fallback
      expect(result[2].hook).toBeTruthy()
    })
  })

  describe('error handling', () => {
    it('throws when LLM call fails', async () => {
      mockCallLLMWithRetry.mockRejectedValue(new Error('LLM API error'))

      await expect(generateOutline(baseOptions)).rejects.toThrow('LLM API error')
    })

    it('throws when all JSON parsing attempts fail', async () => {
      mockCallLLMWithRetry.mockImplementation(async (_options, parser) => {
        const parsed = await parser('totally invalid json {{{')
        return {
          content: parsed,
          cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
          rawResponse: {},
          model: 'test-model',
          provider: 'test-provider'
        }
      })

      mockParseJsonResponse.mockImplementation(() => {
        throw new Error('Parse error')
      })
      mockRepairJsonWithAI.mockResolvedValue('still invalid')

      await expect(generateOutline(baseOptions)).rejects.toThrow()
    })
  })

  describe('different episode targets', () => {
    it('supports custom target episode counts', async () => {
      const mockEpisodes = createMockEpisodes(20)
      mockCallLLMWithRetry.mockResolvedValue({
        content: { episodes: mockEpisodes.slice(0, 20) },
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const result = await generateOutline({
        ...baseOptions,
        targetEpisodes: 20,
        paywallEpisodes: [5, 10, 15]
      })

      expect(result).toHaveLength(20)
      expect(result[4].isPaywall).toBe(true)
      expect(result[9].isPaywall).toBe(true)
      expect(result[14].isPaywall).toBe(true)
    })
  })
})
