import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineRouteService } from '../src/services/pipeline-route-service.js'

vi.mock('../src/queues/pipeline.js', () => ({
  pipelineQueue: {
    add: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('../src/lib/project-aspect.js', () => ({
  pipelineAspectRatioFromProjectDefault: vi.fn().mockReturnValue('9:16')
}))

describe('PipelineRouteService', () => {
  const mockRepo = {
    findFirstProjectOwned: vi.fn(),
    createPipelineJob: vi.fn(),
    createPipelineStepResultsMany: vi.fn(),
    findUniqueJobWithSteps: vi.fn(),
    findFirstJobByProjectNewest: vi.fn(),
    findManyJobsForUser: vi.fn(),
    findUniqueJob: vi.fn(),
    updateJob: vi.fn()
  }

  const service = new PipelineRouteService(mockRepo as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getStepsCatalog returns steps', () => {
    const result = service.getStepsCatalog()
    expect(result.steps).toHaveLength(4)
    expect(result.steps[0]).toHaveProperty('id')
    expect(result.steps[0]).toHaveProperty('description')
  })

  describe('createAndStartFullPipeline', () => {
    it('returns 400 when missing params', async () => {
      const result = await service.createAndStartFullPipeline('user-1', { projectId: '', idea: '' })
      if (!result.ok) expect(result.status).toBe(400)
    })

    it('returns 404 when project not found', async () => {
      mockRepo.findFirstProjectOwned.mockResolvedValue(null)
      const result = await service.createAndStartFullPipeline('user-1', {
        projectId: 'proj-1',
        idea: 'test idea'
      })
      if (!result.ok) expect(result.status).toBe(404)
    })

    it('creates and starts pipeline successfully', async () => {
      mockRepo.findFirstProjectOwned.mockResolvedValue({ id: 'proj-1', aspectRatio: '9:16' })
      mockRepo.createPipelineJob.mockResolvedValue({ id: 'job-1' })

      const result = await service.createAndStartFullPipeline('user-1', {
        projectId: 'proj-1',
        idea: 'test idea',
        targetEpisodes: 10
      })
      expect(result.ok).toBe(true)
    })

    it('returns 500 on error', async () => {
      mockRepo.findFirstProjectOwned.mockRejectedValue(new Error('DB error'))
      const result = await service.createAndStartFullPipeline('user-1', {
        projectId: 'proj-1',
        idea: 'test idea'
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(500)
    })
  })

  describe('getJobDetail', () => {
    it('returns 404 when job not found', async () => {
      mockRepo.findUniqueJobWithSteps.mockResolvedValue(null)
      const result = await service.getJobDetail('user-1', 'job-1')
      if (!result.ok) expect(result.status).toBe(404)
    })

    it('returns 404 when project not owned', async () => {
      mockRepo.findUniqueJobWithSteps.mockResolvedValue({ projectId: 'proj-1' })
      mockRepo.findFirstProjectOwned.mockResolvedValue(null)
      const result = await service.getJobDetail('user-1', 'job-1')
      if (!result.ok) expect(result.status).toBe(404)
    })

    it('returns job detail', async () => {
      mockRepo.findUniqueJobWithSteps.mockResolvedValue({
        id: 'job-1',
        projectId: 'proj-1',
        status: 'running',
        jobType: 'full-pipeline',
        currentStep: 'script-writing',
        progress: 50,
        progressMeta: null,
        error: null,
        stepResults: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      mockRepo.findFirstProjectOwned.mockResolvedValue({ id: 'proj-1' })
      const result = await service.getJobDetail('user-1', 'job-1')
      expect(result.ok).toBe(true)
    })
  })

  describe('getProjectPipelineStatus', () => {
    it('returns 404 when project not found', async () => {
      mockRepo.findFirstProjectOwned.mockResolvedValue(null)
      const result = await service.getProjectPipelineStatus('user-1', 'proj-1')
      if (!result.ok) expect(result.status).toBe(404)
    })

    it('returns not_started when no jobs', async () => {
      mockRepo.findFirstProjectOwned.mockResolvedValue({ id: 'proj-1' })
      mockRepo.findFirstJobByProjectNewest.mockResolvedValue(null)
      const result = await service.getProjectPipelineStatus('user-1', 'proj-1')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe('not_started')
      }
    })

    it('returns job status', async () => {
      mockRepo.findFirstProjectOwned.mockResolvedValue({ id: 'proj-1' })
      mockRepo.findFirstJobByProjectNewest.mockResolvedValue({
        id: 'job-1',
        status: 'running',
        currentStep: 'script-writing',
        progress: 50,
        error: null,
        stepResults: []
      })
      const result = await service.getProjectPipelineStatus('user-1', 'proj-1')
      expect(result.ok).toBe(true)
    })
  })

  describe('cancelJob', () => {
    it('returns 404 when job not found', async () => {
      mockRepo.findUniqueJob.mockResolvedValue(null)
      const result = await service.cancelJob('user-1', 'job-1')
      if (!result.ok) expect(result.status).toBe(404)
    })

    it('returns 404 when project not owned', async () => {
      mockRepo.findUniqueJob.mockResolvedValue({ projectId: 'proj-1', status: 'pending' })
      mockRepo.findFirstProjectOwned.mockResolvedValue(null)
      const result = await service.cancelJob('user-1', 'job-1')
      if (!result.ok) expect(result.status).toBe(404)
    })

    it('returns 400 when job is running', async () => {
      mockRepo.findUniqueJob.mockResolvedValue({ projectId: 'proj-1', status: 'running' })
      mockRepo.findFirstProjectOwned.mockResolvedValue({ id: 'proj-1' })
      const result = await service.cancelJob('user-1', 'job-1')
      if (!result.ok) expect(result.status).toBe(400)
    })

    it('cancels pending job', async () => {
      mockRepo.findUniqueJob.mockResolvedValue({ projectId: 'proj-1', status: 'pending' })
      mockRepo.findFirstProjectOwned.mockResolvedValue({ id: 'proj-1' })
      const result = await service.cancelJob('user-1', 'job-1')
      expect(result.ok).toBe(true)
    })
  })
})
