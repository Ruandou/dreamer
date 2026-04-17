import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineRepository } from '../src/repositories/pipeline-repository.js'

describe('PipelineRepository', () => {
  let repo: PipelineRepository
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      project: { findFirst: vi.fn(), findUnique: vi.fn() },
      pipelineJob: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn()
      },
      pipelineStepResult: {
        createMany: vi.fn(),
        updateMany: vi.fn()
      },
      episode: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
      character: { findMany: vi.fn() },
      location: { findMany: vi.fn(), findFirst: vi.fn() },
      scene: { upsert: vi.fn() },
      shot: { createMany: vi.fn() }
    }

    repo = new PipelineRepository(mockPrisma)
  })

  describe('findFirstProjectOwned', () => {
    it('queries project by id and userId', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        userId: 'user-123',
        name: 'Test Project'
      })

      const result = await repo.findFirstProjectOwned('proj-1', 'user-123')

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'proj-1', userId: 'user-123' }
      })
      expect(result?.name).toBe('Test Project')
    })

    it('returns null when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null)

      const result = await repo.findFirstProjectOwned('nonexistent', 'user-123')

      expect(result).toBeNull()
    })
  })

  describe('createPipelineJob', () => {
    it('creates a new pipeline job', async () => {
      mockPrisma.pipelineJob.create.mockResolvedValue({
        id: 'job-1',
        projectId: 'proj-1',
        status: 'pending',
        jobType: 'script-first'
      })

      const result = await repo.createPipelineJob({
        projectId: 'proj-1',
        status: 'pending',
        jobType: 'script-first',
        currentStep: 'generating',
        progress: 0
      })

      expect(mockPrisma.pipelineJob.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          status: 'pending',
          jobType: 'script-first',
          currentStep: 'generating',
          progress: 0
        }
      })
      expect(result.id).toBe('job-1')
    })
  })

  describe('createPipelineStepResultsMany', () => {
    it('creates multiple step results', async () => {
      mockPrisma.pipelineStepResult.createMany.mockResolvedValue({ count: 3 })

      const result = await repo.createPipelineStepResultsMany([
        { jobId: 'job-1', step: 'parse', status: 'pending' },
        { jobId: 'job-1', step: 'extract', status: 'pending' },
        { jobId: 'job-1', step: 'enrich', status: 'pending' }
      ])

      expect(mockPrisma.pipelineStepResult.createMany).toHaveBeenCalledWith({
        data: [
          { jobId: 'job-1', step: 'parse', status: 'pending' },
          { jobId: 'job-1', step: 'extract', status: 'pending' },
          { jobId: 'job-1', step: 'enrich', status: 'pending' }
        ]
      })
      expect(result.count).toBe(3)
    })
  })

  describe('findUniqueJobWithSteps', () => {
    it('finds job with step results', async () => {
      mockPrisma.pipelineJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'running',
        stepResults: [
          { id: 'step-1', step: 'parse', status: 'completed' },
          { id: 'step-2', step: 'extract', status: 'running' }
        ]
      })

      const result = await repo.findUniqueJobWithSteps('job-1')

      expect(mockPrisma.pipelineJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        include: { stepResults: true }
      })
      expect(result?.stepResults).toHaveLength(2)
    })
  })

  describe('findFirstJobByProjectNewest', () => {
    it('finds newest job for project', async () => {
      mockPrisma.pipelineJob.findFirst.mockResolvedValue({
        id: 'job-2',
        createdAt: new Date('2024-01-02')
      })

      const result = await repo.findFirstJobByProjectNewest('proj-1')

      expect(mockPrisma.pipelineJob.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
        include: { stepResults: true }
      })
      expect(result?.id).toBe('job-2')
    })
  })

  describe('findManyJobsForUser', () => {
    it('finds all jobs for user ordered by creation date', async () => {
      mockPrisma.pipelineJob.findMany.mockResolvedValue([
        {
          id: 'job-1',
          project: { id: 'proj-1', name: 'Project 1' },
          stepResults: []
        },
        {
          id: 'job-2',
          project: { id: 'proj-2', name: 'Project 2' },
          stepResults: []
        }
      ])

      const result = await repo.findManyJobsForUser('user-123')

      expect(mockPrisma.pipelineJob.findMany).toHaveBeenCalledWith({
        where: { project: { userId: 'user-123' } },
        include: {
          project: { select: { id: true, name: true } },
          stepResults: true
        },
        orderBy: { createdAt: 'desc' }
      })
      expect(result).toHaveLength(2)
    })
  })

  describe('findUniqueJob', () => {
    it('finds job by id', async () => {
      mockPrisma.pipelineJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'completed',
        progress: 100
      })

      const result = await repo.findUniqueJob('job-1')

      expect(mockPrisma.pipelineJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' }
      })
      expect(result?.status).toBe('completed')
    })
  })

  describe('updateJob', () => {
    it('updates job fields', async () => {
      mockPrisma.pipelineJob.update.mockResolvedValue({
        id: 'job-1',
        status: 'completed',
        progress: 100
      })

      const result = await repo.updateJob('job-1', {
        status: 'completed',
        progress: 100,
        currentStep: 'completed'
      })

      expect(mockPrisma.pipelineJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'completed',
          progress: 100,
          currentStep: 'completed'
        }
      })
      expect(result.status).toBe('completed')
    })
  })

  describe('countActiveEpisodeStoryboardScriptJobs', () => {
    it('counts active jobs for specific episode', async () => {
      mockPrisma.pipelineJob.findMany.mockResolvedValue([
        { progressMeta: { episodeId: 'ep-1' } },
        { progressMeta: { episodeId: 'ep-1' } },
        { progressMeta: { episodeId: 'ep-2' } }
      ])

      const result = await repo.countActiveEpisodeStoryboardScriptJobs('proj-1', 'ep-1')

      expect(mockPrisma.pipelineJob.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          jobType: 'episode-storyboard-script',
          status: { in: ['pending', 'running'] }
        },
        select: { progressMeta: true }
      })
      expect(result).toBe(2)
    })

    it('returns 0 when no jobs found', async () => {
      mockPrisma.pipelineJob.findMany.mockResolvedValue([])

      const result = await repo.countActiveEpisodeStoryboardScriptJobs('proj-1', 'ep-1')

      expect(result).toBe(0)
    })

    it('filters by episodeId in progressMeta', async () => {
      mockPrisma.pipelineJob.findMany.mockResolvedValue([
        { progressMeta: { episodeId: 'ep-2' } },
        { progressMeta: { episodeId: 'ep-3' } },
        { progressMeta: null }
      ])

      const result = await repo.countActiveEpisodeStoryboardScriptJobs('proj-1', 'ep-1')

      expect(result).toBe(0)
    })
  })

  describe('findEpisodeIdsWithCompletedStoryboardScript', () => {
    it('returns set of episode ids from completed jobs', async () => {
      mockPrisma.pipelineJob.findMany.mockResolvedValue([
        { progressMeta: { episodeId: 'ep-1' } },
        { progressMeta: { episodeId: 'ep-2' } },
        { progressMeta: { episodeId: 'ep-1' } }
      ])

      const result = await repo.findEpisodeIdsWithCompletedStoryboardScript('proj-1')

      expect(mockPrisma.pipelineJob.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          jobType: 'episode-storyboard-script',
          status: 'completed'
        },
        select: { progressMeta: true }
      })
      expect(result).toBeInstanceOf(Set)
      expect(result.has('ep-1')).toBe(true)
      expect(result.has('ep-2')).toBe(true)
      expect(result.has('ep-3')).toBe(false)
    })

    it('returns empty set when no completed jobs', async () => {
      mockPrisma.pipelineJob.findMany.mockResolvedValue([])

      const result = await repo.findEpisodeIdsWithCompletedStoryboardScript('proj-1')

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(0)
    })
  })

  describe('hasCompletedEpisodeStoryboardScriptJob', () => {
    it('returns true when episode has completed job', async () => {
      vi.spyOn(repo, 'findEpisodeIdsWithCompletedStoryboardScript').mockResolvedValue(
        new Set(['ep-1', 'ep-2'])
      )

      const result = await repo.hasCompletedEpisodeStoryboardScriptJob('proj-1', 'ep-1')

      expect(result).toBe(true)
    })

    it('returns false when episode has no completed job', async () => {
      vi.spyOn(repo, 'findEpisodeIdsWithCompletedStoryboardScript').mockResolvedValue(
        new Set(['ep-1', 'ep-2'])
      )

      const result = await repo.hasCompletedEpisodeStoryboardScriptJob('proj-1', 'ep-3')

      expect(result).toBe(false)
    })
  })

  describe('countOutlineAsyncJobs', () => {
    it('counts pending or running outline jobs', async () => {
      mockPrisma.pipelineJob.count.mockResolvedValue(3)

      const result = await repo.countOutlineAsyncJobs('proj-1')

      expect(mockPrisma.pipelineJob.count).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          status: { in: ['pending', 'running'] },
          jobType: { in: ['script-batch', 'parse-script', 'script-first'] }
        }
      })
      expect(result).toBe(3)
    })
  })

  describe('getActiveOutlinePipelineJob', () => {
    it('returns parse-script job if exists', async () => {
      mockPrisma.pipelineJob.findFirst
        .mockResolvedValueOnce({ id: 'parse-job', jobType: 'parse-script' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const result = await repo.getActiveOutlinePipelineJob('proj-1')

      expect(result?.jobType).toBe('parse-script')
      expect(mockPrisma.pipelineJob.findFirst).toHaveBeenCalledTimes(1)
    })

    it('returns script-batch job if no parse-script', async () => {
      mockPrisma.pipelineJob.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'batch-job', jobType: 'script-batch' })
        .mockResolvedValueOnce(null)

      const result = await repo.getActiveOutlinePipelineJob('proj-1')

      expect(result?.jobType).toBe('script-batch')
    })

    it('returns script-first job if no parse or batch', async () => {
      mockPrisma.pipelineJob.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'first-job', jobType: 'script-first' })

      const result = await repo.getActiveOutlinePipelineJob('proj-1')

      expect(result?.jobType).toBe('script-first')
    })

    it('returns null when no active jobs', async () => {
      mockPrisma.pipelineJob.findFirst.mockResolvedValue(null)

      const result = await repo.getActiveOutlinePipelineJob('proj-1')

      expect(result).toBeNull()
    })
  })

  describe('updateStepResult', () => {
    it('updates step result status', async () => {
      mockPrisma.pipelineStepResult.updateMany.mockResolvedValue({ count: 1 })

      const result = await repo.updateStepResult('job-1', 'parse', {
        status: 'completed',
        output: { data: 'test' }
      })

      expect(mockPrisma.pipelineStepResult.updateMany).toHaveBeenCalledWith({
        where: { jobId: 'job-1', step: 'parse' },
        data: expect.objectContaining({
          status: 'completed',
          output: { data: 'test' }
        })
      })
      expect(result.count).toBe(1)
    })
  })

  describe('findProjectUserId', () => {
    it('finds project user id', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ userId: 'user-123' })

      const result = await repo.findProjectUserId('proj-1')

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        select: { userId: true }
      })
      expect(result?.userId).toBe('user-123')
    })
  })

  describe('findEpisodesUpTo', () => {
    it('finds episodes up to max number', async () => {
      mockPrisma.episode.findMany.mockResolvedValue([
        { episodeNum: 1 },
        { episodeNum: 2 },
        { episodeNum: 3 }
      ])

      const result = await repo.findEpisodesUpTo('proj-1', 3)

      expect(mockPrisma.episode.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', episodeNum: { lte: 3 } },
        orderBy: { episodeNum: 'asc' }
      })
      expect(result).toHaveLength(3)
    })
  })

  describe('findCharactersWithImages', () => {
    it('finds characters with images', async () => {
      mockPrisma.character.findMany.mockResolvedValue([
        { id: 'char-1', images: [] },
        { id: 'char-2', images: [{ id: 'img-1' }] }
      ])

      const result = await repo.findCharactersWithImages('proj-1')

      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        include: { images: true }
      })
      expect(result).toHaveLength(2)
    })
  })

  describe('findLocationsActive', () => {
    it('finds active locations', async () => {
      mockPrisma.location.findMany.mockResolvedValue([
        { id: 'loc-1', name: 'Location 1' },
        { id: 'loc-2', name: 'Location 2' }
      ])

      const result = await repo.findLocationsActive('proj-1')

      expect(mockPrisma.location.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', deletedAt: null }
      })
      expect(result).toHaveLength(2)
    })
  })
})
