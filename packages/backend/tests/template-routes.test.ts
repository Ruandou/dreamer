import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

const {
  mockProjectFindFirst,
  mockProjectUpdate,
  mockProjectOutlineUpsert,
  mockEpisodeFindMany,
  mockEpisodeCreate,
  mockEpisodeUpdateMany,
  mockGenerateOutline
} = vi.hoisted(() => ({
  mockProjectFindFirst: vi.fn(),
  mockProjectUpdate: vi.fn(),
  mockProjectOutlineUpsert: vi.fn(),
  mockEpisodeFindMany: vi.fn(),
  mockEpisodeCreate: vi.fn(),
  mockEpisodeUpdateMany: vi.fn(),
  mockGenerateOutline: vi.fn()
}))

vi.mock('../src/services/ai/outline-generator.js', () => ({
  generateOutline: (...args: unknown[]) => mockGenerateOutline(...args) as Promise<unknown[]>
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    project: {
      findFirst: mockProjectFindFirst,
      update: mockProjectUpdate
    },
    projectOutline: {
      upsert: mockProjectOutlineUpsert
    },
    episode: {
      findMany: mockEpisodeFindMany,
      create: mockEpisodeCreate,
      updateMany: mockEpisodeUpdateMany
    },
    dramaTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn()
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { templateRoutes } from '../src/routes/templates.js'

describe('Template routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate(
      'authenticate',
      vi.fn().mockImplementation(async (request: any) => {
        request.user = { id: 'test-user-id', email: 'test@example.com' }
      })
    )
    await app.register(templateRoutes, { prefix: '/api/templates' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/templates', () => {
    it('returns builtin and custom templates', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/templates'
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.builtin).toHaveLength(10)
      expect(body.custom).toEqual([])
    })
  })

  describe('GET /api/templates/:id', () => {
    it('returns builtin template by id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/templates/builtin-soninlaw'
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.name).toBe('赘婿逆袭流')
      expect(body.structure.acts).toHaveLength(4)
    })

    it('returns 404 for unknown template', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/templates/unknown'
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /api/templates/:id/generate-outline', () => {
    const mockEpisodes = Array.from({ length: 40 }, (_, i) => ({
      episodeNum: i + 1,
      title: `第${i + 1}集`,
      synopsis: `第${i + 1}集梗概`,
      hook: `第${i + 1}集钩子`,
      cliffhanger: `第${i + 1}集悬念`,
      isPaywall: [10, 20, 30].includes(i + 1)
    }))

    it('returns 404 when project not found', async () => {
      mockProjectFindFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/api/templates/builtin-soninlaw/generate-outline',
        payload: { projectId: 'missing' }
      })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.payload)
      expect(body.error).toContain('项目不存在')
    })

    it('returns 404 when template not found', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/templates/unknown/generate-outline',
        payload: { projectId: 'p1' }
      })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.payload)
      expect(body.error).toContain('模板不存在')
    })

    it('generates outline and creates episodes', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockGenerateOutline.mockResolvedValue(mockEpisodes)
      mockProjectOutlineUpsert.mockResolvedValue({ id: 'outline-1' })
      mockProjectUpdate.mockResolvedValue({ id: 'p1' })
      mockEpisodeFindMany.mockResolvedValue([])
      mockEpisodeCreate.mockResolvedValue({ id: 'ep-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/templates/builtin-soninlaw/generate-outline',
        payload: {
          projectId: 'p1',
          protagonistName: '林凡',
          protagonistIdentity: '隐世家族继承人',
          coreConflict: '身份冲突',
          targetAudience: '下沉市场',
          targetEpisodes: 40
        }
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.outline).toHaveLength(40)
      expect(body.template).toBe('赘婿逆袭流')

      expect(mockGenerateOutline).toHaveBeenCalledWith(
        expect.objectContaining({
          templateName: '赘婿逆袭流',
          protagonistName: '林凡',
          targetEpisodes: 40,
          userId: 'test-user-id',
          projectId: 'p1'
        })
      )
      expect(mockProjectOutlineUpsert).toHaveBeenCalled()
      expect(mockProjectUpdate).toHaveBeenCalled()
      expect(mockEpisodeCreate).toHaveBeenCalledTimes(40)
    })

    it('updates existing episodes instead of creating duplicates', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockGenerateOutline.mockResolvedValue(mockEpisodes)
      mockProjectOutlineUpsert.mockResolvedValue({ id: 'outline-1' })
      mockProjectUpdate.mockResolvedValue({ id: 'p1' })
      // Episodes 1-10 already exist
      mockEpisodeFindMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ episodeNum: i + 1 }))
      )
      mockEpisodeUpdateMany.mockResolvedValue({ count: 1 })

      const res = await app.inject({
        method: 'POST',
        url: '/api/templates/builtin-ceo/generate-outline',
        payload: { projectId: 'p1' }
      })

      expect(res.statusCode).toBe(200)
      // Should create 30 new episodes (11-40)
      expect(mockEpisodeCreate).toHaveBeenCalledTimes(30)
      // Should update 10 existing episodes
      expect(mockEpisodeUpdateMany).toHaveBeenCalledTimes(10)
    })

    it('returns 500 when generation fails', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockGenerateOutline.mockRejectedValue(new Error('LLM timeout'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/templates/builtin-revenge/generate-outline',
        payload: { projectId: 'p1' }
      })

      expect(res.statusCode).toBe(500)
      const body = JSON.parse(res.payload)
      expect(body.error).toContain('生成大纲失败')
      expect(body.error).toContain('LLM timeout')
    })
  })
})
