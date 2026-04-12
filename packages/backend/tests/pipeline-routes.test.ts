import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockProjectFindFirst,
  mockProjectFindMany,
  mockPipelineJobFindMany,
  mockPipelineJobFindUnique,
  mockPipelineJobCreate,
  mockPipelineStepResultCreateMany
} = vi.hoisted(() => {
  return {
    mockProjectFindFirst: vi.fn(),
    mockProjectFindMany: vi.fn(),
    mockPipelineJobFindMany: vi.fn(),
    mockPipelineJobFindUnique: vi.fn(),
    mockPipelineJobCreate: vi.fn(),
    mockPipelineStepResultCreateMany: vi.fn()
  }
})

// Mock executePipelineJob
const mockExecutePipelineJob = vi.fn()

// Mock the index.js module
vi.mock('../src/index.js', () => ({
  prisma: {
    project: {
      findFirst: mockProjectFindFirst,
      findMany: mockProjectFindMany
    },
    pipelineJob: {
      findMany: mockPipelineJobFindMany,
      findUnique: mockPipelineJobFindUnique,
      create: mockPipelineJobCreate
    },
    pipelineStepResult: {
      createMany: mockPipelineStepResultCreateMany
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Mock the executor
vi.mock('../src/services/pipeline-executor.js', () => ({
  executePipelineJob: (...args: any[]) => mockExecutePipelineJob(...args)
}))

// Import routes after all mocks are set up
import { pipelineRoutes } from '../src/routes/pipeline.js'

describe('Pipeline Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })

    // Mock authenticate
    app.decorate('authenticate', vi.fn().mockImplementation(async (request: any, reply: any) => {
      request.user = { id: 'test-user-id', email: 'test@example.com' }
    }))

    await app.register(pipelineRoutes, { prefix: '/api/pipeline' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/pipeline/steps', () => {
    it('should return pipeline steps', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/steps'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(data.steps).toBeDefined()
      expect(Array.isArray(data.steps)).toBe(true)
      expect(data.steps.length).toBe(4)
      expect(data.steps[0].id).toBe('script-writing')
    })
  })

  describe('GET /api/pipeline/jobs', () => {
    it('should return all pipeline jobs for user', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          projectId: 'proj-1',
          status: 'completed',
          currentStep: 'storyboard',
          progress: 100,
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          project: { id: 'proj-1', name: 'Test Project' }
        },
        {
          id: 'job-2',
          projectId: 'proj-2',
          status: 'running',
          currentStep: 'segment-extract',
          progress: 50,
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          project: { id: 'proj-2', name: 'Another Project' }
        }
      ]
      mockPipelineJobFindMany.mockResolvedValue(mockJobs)

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/jobs'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
      expect(data[0].id).toBe('job-1')
      expect(data[0].projectName).toBe('Test Project')
      expect(data[1].status).toBe('running')
      expect(data[1].progress).toBe(50)
    })

    it('should return empty array when no jobs', async () => {
      mockPipelineJobFindMany.mockResolvedValue([])

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/jobs'
      })

      expect(response.statusCode).toBe(200)
      const data = JSON.parse(response.payload)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(0)
    })

    it('should include stepResults in response', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          projectId: 'proj-1',
          status: 'completed',
          currentStep: 'storyboard',
          progress: 100,
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          project: { id: 'proj-1', name: 'Test Project' },
          stepResults: [
            { step: 'script-writing', status: 'completed' },
            { step: 'episode-split', status: 'completed' }
          ]
        }
      ]
      mockPipelineJobFindMany.mockResolvedValue(mockJobs)

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/jobs'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /api/pipeline/job/:jobId', () => {
    it('returns jobType and progressMeta in data envelope', async () => {
      mockPipelineJobFindUnique.mockResolvedValue({
        id: 'job-1',
        projectId: 'proj-1',
        status: 'running',
        jobType: 'script-batch',
        currentStep: 'script-batch',
        progress: 40,
        progressMeta: { current: 5, total: 60, message: '正在生成第 5/60 集' },
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stepResults: []
      })
      mockProjectFindFirst.mockResolvedValue({ id: 'proj-1', userId: 'test-user-id' })

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/job/job-1'
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.success).toBe(true)
      expect(body.data.jobType).toBe('script-batch')
      expect(body.data.progressMeta?.current).toBe(5)
      expect(body.data.progressMeta?.message).toContain('5/60')
    })

    it('returns 404 when job not found', async () => {
      mockPipelineJobFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/job/missing'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
