import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'

// Use vi.hoisted to define mocks before module loading
const {
  mockProjectFindFirst,
  mockProjectFindMany,
  mockPipelineJobFindMany,
  mockPipelineJobFindUnique,
  mockPipelineJobFindFirst,
  mockPipelineJobCreate,
  mockPipelineJobUpdate,
  mockPipelineStepResultCreateMany
} = vi.hoisted(() => {
  return {
    mockProjectFindFirst: vi.fn(),
    mockProjectFindMany: vi.fn(),
    mockPipelineJobFindMany: vi.fn(),
    mockPipelineJobFindUnique: vi.fn(),
    mockPipelineJobFindFirst: vi.fn(),
    mockPipelineJobCreate: vi.fn(),
    mockPipelineJobUpdate: vi.fn(),
    mockPipelineStepResultCreateMany: vi.fn()
  }
})

// Mock executePipelineJob
const mockExecutePipelineJob = vi.fn()

// Mock the index.js module
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    project: {
      findFirst: mockProjectFindFirst,
      findMany: mockProjectFindMany
    },
    pipelineJob: {
      findMany: mockPipelineJobFindMany,
      findUnique: mockPipelineJobFindUnique,
      findFirst: mockPipelineJobFindFirst,
      create: mockPipelineJobCreate,
      update: mockPipelineJobUpdate
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
    app.decorate(
      'authenticate',
      vi.fn().mockImplementation(async (request: any, reply: any) => {
        request.user = { id: 'test-user-id', email: 'test@example.com' }
      })
    )

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
          jobType: 'full-pipeline',
          status: 'completed',
          currentStep: 'storyboard',
          progress: 100,
          error: null,
          progressMeta: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          project: { id: 'proj-1', name: 'Test Project' }
        },
        {
          id: 'job-2',
          projectId: 'proj-2',
          jobType: 'parse-script',
          status: 'running',
          currentStep: 'parse-script',
          progress: 50,
          error: null,
          progressMeta: { message: '解析中' },
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
      expect(data[0].jobType).toBe('full-pipeline')
      expect(data[1].status).toBe('running')
      expect(data[1].jobType).toBe('parse-script')
      expect(data[1].progressMeta).toEqual({ message: '解析中' })
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
          jobType: 'full-pipeline',
          status: 'completed',
          currentStep: 'storyboard',
          progress: 100,
          error: null,
          progressMeta: null,
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
        progressMeta: { current: 5, total: 6, message: '正在生成第 5/6 集' },
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
      expect(body.data.progressMeta?.message).toContain('5/6')
    })

    it('returns 404 when job not found', async () => {
      mockPipelineJobFindUnique.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/job/missing'
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 404 when job belongs to another user project', async () => {
      mockPipelineJobFindUnique.mockResolvedValue({
        id: 'job-x',
        projectId: 'proj-other',
        status: 'pending',
        jobType: 'full-pipeline',
        currentStep: 'script-writing',
        progress: 0,
        error: null,
        progressMeta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stepResults: []
      })
      mockProjectFindFirst.mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/job/job-x'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/pipeline/execute', () => {
    it('returns 400 when projectId or idea missing', async () => {
      const r1 = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute',
        payload: { idea: 'x' }
      })
      expect(r1.statusCode).toBe(400)

      const r2 = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute',
        payload: { projectId: 'p1' }
      })
      expect(r2.statusCode).toBe(400)
    })

    it('returns 404 when project not found', async () => {
      mockProjectFindFirst.mockResolvedValue(null)
      const r = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute',
        payload: { projectId: 'p-missing', idea: 'novel' }
      })
      expect(r.statusCode).toBe(404)
    })

    it('creates job and calls executePipelineJob', async () => {
      mockProjectFindFirst.mockResolvedValue({
        id: 'proj-1',
        userId: 'test-user-id',
        aspectRatio: '16:9'
      })
      mockPipelineJobCreate.mockResolvedValue({
        id: 'new-job-id',
        projectId: 'proj-1',
        status: 'pending',
        jobType: 'full-pipeline',
        currentStep: 'script-writing',
        progress: 0
      })
      mockPipelineStepResultCreateMany.mockResolvedValue({ count: 4 })
      mockExecutePipelineJob.mockResolvedValue(undefined)

      const r = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute',
        payload: {
          projectId: 'proj-1',
          idea: '一个悬疑故事',
          targetEpisodes: 3,
          defaultResolution: '480p'
        }
      })

      expect(r.statusCode).toBe(200)
      const body = JSON.parse(r.payload)
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBe('new-job-id')
      expect(mockPipelineJobCreate).toHaveBeenCalled()
      expect(mockPipelineStepResultCreateMany).toHaveBeenCalled()
      expect(mockExecutePipelineJob).toHaveBeenCalledWith(
        'new-job-id',
        expect.objectContaining({
          projectId: 'proj-1',
          idea: '一个悬疑故事',
          targetEpisodes: 3,
          defaultAspectRatio: '16:9',
          defaultResolution: '480p'
        })
      )
    })
  })

  describe('GET /api/pipeline/status/:projectId', () => {
    it('returns 404 when project not found', async () => {
      mockProjectFindFirst.mockResolvedValue(null)
      const r = await app.inject({
        method: 'GET',
        url: '/api/pipeline/status/bad-proj'
      })
      expect(r.statusCode).toBe(404)
    })

    it('returns not_started when no pipeline job', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockPipelineJobFindFirst.mockResolvedValue(null)

      const r = await app.inject({
        method: 'GET',
        url: '/api/pipeline/status/p1'
      })

      expect(r.statusCode).toBe(200)
      const body = JSON.parse(r.payload)
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('not_started')
    })

    it('returns latest job payload', async () => {
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockPipelineJobFindFirst.mockResolvedValue({
        id: 'j1',
        status: 'running',
        currentStep: 'episode-split',
        progress: 30,
        error: null,
        stepResults: [{ step: 'script-writing', status: 'completed' }]
      })

      const r = await app.inject({
        method: 'GET',
        url: '/api/pipeline/status/p1'
      })

      expect(r.statusCode).toBe(200)
      const body = JSON.parse(r.payload)
      expect(body.data.id).toBe('j1')
      expect(body.data.status).toBe('running')
      expect(body.data.stepResults).toHaveLength(1)
    })
  })

  describe('DELETE /api/pipeline/job/:jobId', () => {
    it('returns 404 when job not found', async () => {
      mockPipelineJobFindUnique.mockResolvedValue(null)
      const r = await app.inject({ method: 'DELETE', url: '/api/pipeline/job/none' })
      expect(r.statusCode).toBe(404)
    })

    it('returns 404 when user does not own project', async () => {
      mockPipelineJobFindUnique.mockResolvedValue({
        id: 'j1',
        projectId: 'p1',
        status: 'pending'
      })
      mockProjectFindFirst.mockResolvedValue(null)

      const r = await app.inject({ method: 'DELETE', url: '/api/pipeline/job/j1' })
      expect(r.statusCode).toBe(404)
    })

    it('returns 400 when job is running', async () => {
      mockPipelineJobFindUnique.mockResolvedValue({
        id: 'j1',
        projectId: 'p1',
        status: 'running'
      })
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })

      const r = await app.inject({ method: 'DELETE', url: '/api/pipeline/job/j1' })
      expect(r.statusCode).toBe(400)
    })

    it('marks job failed and returns success', async () => {
      mockPipelineJobFindUnique.mockResolvedValue({
        id: 'j1',
        projectId: 'p1',
        status: 'pending'
      })
      mockProjectFindFirst.mockResolvedValue({ id: 'p1', userId: 'test-user-id' })
      mockPipelineJobUpdate.mockResolvedValue({ id: 'j1' })

      const r = await app.inject({ method: 'DELETE', url: '/api/pipeline/job/j1' })
      expect(r.statusCode).toBe(200)
      expect(JSON.parse(r.payload).success).toBe(true)
      expect(mockPipelineJobUpdate).toHaveBeenCalledWith({
        where: { id: 'j1' },
        data: { status: 'failed', error: '用户取消' }
      })
    })
  })
})
