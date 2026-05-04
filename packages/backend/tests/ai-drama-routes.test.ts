import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockEpisodeFindUnique,
  mockVerifyEpisodeOwnership,
  mockCallLLMWithRetry,
  mockGetDefaultProvider
} = vi.hoisted(() => ({
  mockEpisodeFindUnique: vi.fn(),
  mockVerifyEpisodeOwnership: vi.fn(),
  mockCallLLMWithRetry: vi.fn(),
  mockGetDefaultProvider: vi.fn()
}))

vi.mock('../src/plugins/auth.js', () => ({
  verifyEpisodeOwnership: (...args: unknown[]) => mockVerifyEpisodeOwnership(...args),
  getRequestUserId: () => 'test-user-id',
  verifyProjectOwnership: vi.fn()
}))

vi.mock('../src/services/ai/llm/llm-call-wrapper.js', () => ({
  callLLMWithRetry: (...args: unknown[]) => mockCallLLMWithRetry(...args)
}))

vi.mock('../src/services/ai/llm-factory.js', () => ({
  getDefaultProvider: () => mockGetDefaultProvider(),
  getProviderForUser: () => mockGetDefaultProvider()
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    episode: {
      findUnique: mockEpisodeFindUnique
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { aiDramaRoutes } from '../src/routes/ai-drama.js'

describe('AI Drama routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate(
      'authenticate',
      vi.fn().mockImplementation(async (request: any) => {
        request.user = { id: 'test-user-id', email: 'test@example.com' }
      })
    )
    await app.register(aiDramaRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDefaultProvider.mockReturnValue({
      name: 'test-provider',
      getConfig: () => ({ defaultModel: 'test-model' })
    })
    mockVerifyEpisodeOwnership.mockResolvedValue(true)
  })

  describe('POST /api/episodes/:id/ai-drama', () => {
    const mockEpisode = {
      id: 'ep1',
      projectId: 'p1',
      content: '测试剧本内容',
      hook: '开头钩子',
      cliffhanger: '结尾悬念',
      project: {
        id: 'p1',
        name: '测试项目',
        templateId: 'builtin-soninlaw',
        characters: [
          { name: '林凡', personality: '隐忍', relationship: '赘婿' },
          { name: '苏婉清', personality: '温柔', relationship: '妻子' }
        ]
      }
    }

    it('returns 403 when user does not own episode', async () => {
      mockVerifyEpisodeOwnership.mockResolvedValue(false)

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'continue' }
      })
      expect(res.statusCode).toBe(403)
    })

    it('returns 404 when episode not found', async () => {
      mockEpisodeFindUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'continue' }
      })
      expect(res.statusCode).toBe(404)
    })

    it('generates continue content', async () => {
      mockEpisodeFindUnique.mockResolvedValue(mockEpisode)
      mockCallLLMWithRetry.mockResolvedValue({
        content: '续写内容',
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'continue' }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.content).toBe('续写内容')
      expect(body.command).toBe('continue')

      const callArgs = mockCallLLMWithRetry.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain('林凡')
      expect(callArgs.messages[0].content).toContain('苏婉清')
      expect(callArgs.messages[0].content).toContain('一句一顶撞')
    })

    it('generates polish content', async () => {
      mockEpisodeFindUnique.mockResolvedValue(mockEpisode)
      mockCallLLMWithRetry.mockResolvedValue({
        content: '润色后内容',
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'polish' }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.content).toBe('润色后内容')
      expect(body.command).toBe('polish')

      const callArgs = mockCallLLMWithRetry.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain('怒斥')
      expect(callArgs.messages[0].content).toContain('冷笑')
    })

    it('generates hook options', async () => {
      mockEpisodeFindUnique.mockResolvedValue(mockEpisode)
      mockCallLLMWithRetry.mockResolvedValue({
        content: '钩子方案',
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'hook' }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.content).toBe('钩子方案')
      expect(body.command).toBe('hook')

      const callArgs = mockCallLLMWithRetry.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain('身份悬念')
      expect(callArgs.messages[0].content).toContain('付费转化潜力')
    })

    it('generates conflict enhancement', async () => {
      mockEpisodeFindUnique.mockResolvedValue(mockEpisode)
      mockCallLLMWithRetry.mockResolvedValue({
        content: '冲突强化内容',
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'conflict' }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.content).toBe('冲突强化内容')
      expect(body.command).toBe('conflict')

      const callArgs = mockCallLLMWithRetry.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain('对抗式对白')
      expect(callArgs.messages[0].content).toContain('A质疑')
    })

    it('generates ad copy', async () => {
      mockEpisodeFindUnique.mockResolvedValue(mockEpisode)
      mockCallLLMWithRetry.mockResolvedValue({
        content: '广告文案',
        cost: { costCNY: 0.1, inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        rawResponse: {},
        model: 'test-model',
        provider: 'test-provider'
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'ad' }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.content).toBe('广告文案')
      expect(body.command).toBe('ad')

      const callArgs = mockCallLLMWithRetry.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain('高光10秒')
      expect(callArgs.messages[0].content).toContain('投流广告文案')
    })

    it('returns 500 when LLM fails', async () => {
      mockEpisodeFindUnique.mockResolvedValue(mockEpisode)
      mockCallLLMWithRetry.mockRejectedValue(new Error('LLM timeout'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/episodes/ep1/ai-drama',
        payload: { command: 'continue' }
      })

      expect(res.statusCode).toBe(500)
      const body = JSON.parse(res.payload)
      expect(body.error).toContain('AI 生成失败')
    })
  })
})
