import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockOutlineJobCreate,
  mockOutlineJobFindUnique
} = vi.hoisted(() => {
  return {
    mockOutlineJobCreate: vi.fn(),
    mockOutlineJobFindUnique: vi.fn()
  }
})

const mockGetOutlineJob = vi.fn()

// Mock the index.js module
vi.mock('../src/index.js', () => ({
  prisma: {
    outlineJob: {
      create: mockOutlineJobCreate,
      findUnique: mockOutlineJobFindUnique
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Mock the queue
vi.mock('../src/queues/outline.js', () => ({
  createOutlineJob: vi.fn().mockResolvedValue('job-123'),
  getOutlineJob: (...args: any[]) => mockGetOutlineJob(...args)
}))

// Import routes after all mocks are set up
import { projectRoutes } from '../src/routes/projects.js'
import { expectPermissionDeniedPayload } from './helpers/expect-http.js'

describe('Outline Job Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', vi.fn().mockImplementation(async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    }))

    await app.register(projectRoutes, { prefix: '/api/projects' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/projects/generate-outline', () => {
    it('should create an outline job and return jobId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/generate-outline',
        payload: {
          idea: '一个关于穿越的爱情故事'
        }
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.jobId).toBe('job-123')
    })

    it('should return 400 when idea is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/generate-outline',
        payload: {
          idea: ''
        }
      })

      expect(response.statusCode).toBe(400)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('想法不能为空')
    })

    it('should return 400 when idea is only whitespace', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/generate-outline',
        payload: {
          idea: '   '
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/projects/outline-job/:jobId', () => {
    it('should return outline job details', async () => {
      const mockJob = {
        id: 'job-123',
        userId: 'test-user-id',
        status: 'completed',
        idea: '测试想法',
        result: {
          outline: {
            title: '测试大纲',
            summary: '测试摘要',
            metadata: { genre: '喜剧' },
            sceneCount: 5
          }
        }
      }
      mockGetOutlineJob.mockResolvedValue(mockJob)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/outline-job/job-123'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.id).toBe('job-123')
      expect(data.status).toBe('completed')
      expect(data.result.outline.title).toBe('测试大纲')
    })

    it('should return 404 when job not found', async () => {
      mockGetOutlineJob.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/outline-job/nonexistent'
      })

      expect(response.statusCode).toBe(404)
      const data = JSON.parse(response.payload)
      expect(data.error).toBe('任务不存在')
    })

    it('should return 403 when job belongs to different user', async () => {
      mockGetOutlineJob.mockResolvedValue({
        id: 'job-123',
        userId: 'other-user-id',
        status: 'pending'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/outline-job/job-123'
      })

      expectPermissionDeniedPayload(response)
    })

    it('should return running status for pending job', async () => {
      mockGetOutlineJob.mockResolvedValue({
        id: 'job-123',
        userId: 'test-user-id',
        status: 'running',
        idea: '测试想法'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/outline-job/job-123'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.status).toBe('running')
    })

    it('should return failed status with error message', async () => {
      mockGetOutlineJob.mockResolvedValue({
        id: 'job-123',
        userId: 'test-user-id',
        status: 'failed',
        idea: '测试想法',
        error: 'AI 服务调用失败'
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/outline-job/job-123'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.status).toBe('failed')
      expect(data.error).toBe('AI 服务调用失败')
    })
  })
})
