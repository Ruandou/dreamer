/**
 * BatchEpisodeGenerator 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { batchEpisodeGenerator } from '../../src/services/script-processing/batch-episode-generator.js'
import { projectRepository } from '../../src/repositories/project-repository.js'
import { pipelineRepository } from '../../src/repositories/pipeline-repository.js'
import { scriptFromJson } from '../../src/services/script-job-helpers.js'
import {
  runGenerateFirstEpisode,
  runScriptBatchJob
} from '../../src/services/project-script-jobs.js'

vi.mock('../../src/repositories/project-repository.js', () => ({
  projectRepository: {
    findEpisodeByProjectNum: vi.fn(),
    findUniqueWithEpisodesOrdered: vi.fn(),
    findUniqueById: vi.fn(),
    upsertEpisodeFirstFromScript: vi.fn(),
    update: vi.fn()
  }
}))

vi.mock('../../src/repositories/pipeline-repository.js', () => ({
  pipelineRepository: {
    updateJob: vi.fn(),
    createPipelineJob: vi.fn(),
    findUniqueJob: vi.fn()
  }
}))

vi.mock('../../src/services/script-job-helpers.js', () => ({
  scriptFromJson: vi.fn()
}))

vi.mock('../../src/services/project-script-jobs.js', () => ({
  runGenerateFirstEpisode: vi.fn(),
  runScriptBatchJob: vi.fn()
}))

vi.mock('../../src/services/script-writer.js', () => ({
  writeScriptFromIdea: vi.fn().mockResolvedValue({
    script: { title: 'Test', summary: 'Summary', scenes: [] },
    cost: { totalTokens: 100, costCNY: 0.01, inputTokens: 50, outputTokens: 50 }
  }),
  formatScriptToJSON: vi.fn()
}))

vi.mock('../../src/services/memory/index.js', () => ({
  safeExtractAndSaveMemories: vi.fn().mockResolvedValue(undefined)
}))

describe('BatchEpisodeGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureAllScripts', () => {
    it('should skip when all episodes exist', async () => {
      vi.mocked(projectRepository.findEpisodeByProjectNum).mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        script: { title: 'Test', scenes: [] }
      } as any)

      vi.mocked(scriptFromJson).mockReturnValue({ title: 'Test', summary: 'Summary', scenes: [] })

      const mockEpisodes = Array.from({ length: 10 }, (_, i) => ({
        id: `ep-${i + 1}`,
        episodeNum: i + 1,
        script: { title: `Episode ${i + 1}`, scenes: [] }
      }))

      vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue({
        id: 'proj-1',
        episodes: mockEpisodes
      } as any)

      await batchEpisodeGenerator.ensureAllScripts('proj-1', 10)

      expect(runGenerateFirstEpisode).not.toHaveBeenCalled()
      expect(runScriptBatchJob).not.toHaveBeenCalled()
    })

    it.skip('should create batch job when episodes missing', async () => {
      vi.mocked(projectRepository.findEpisodeByProjectNum).mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        script: { title: 'Test', scenes: [] }
      } as any)

      vi.mocked(scriptFromJson)
        .mockReturnValueOnce({ title: 'Test', summary: 'Summary', scenes: [] })
        .mockReturnValueOnce(null)

      vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue({
        id: 'proj-1',
        episodes: [{ id: 'ep-1', episodeNum: 1, script: { title: 'Test', scenes: [] } }]
      } as any)

      vi.mocked(pipelineRepository.createPipelineJob).mockResolvedValue({
        id: 'job-1',
        status: 'running',
        projectId: 'proj-1',
        jobType: 'script-batch',
        currentStep: 'script-batch',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      vi.mocked(pipelineRepository.findUniqueJob).mockResolvedValue({
        id: 'job-1',
        status: 'running'
      } as any)

      await batchEpisodeGenerator.ensureAllScripts('proj-1', 10)

      expect(runScriptBatchJob).toHaveBeenCalled()
      expect(pipelineRepository.createPipelineJob).toHaveBeenCalled()
    })
  })

  describe('generateBatch', () => {
    it('should throw error when project not found', async () => {
      vi.mocked(projectRepository.findUniqueById).mockResolvedValue(null)

      await expect(
        batchEpisodeGenerator.generateBatch({ projectId: 'non-existent' })
      ).rejects.toThrow('PROJECT_NOT_FOUND')
    })

    it('should return batch result', async () => {
      vi.mocked(projectRepository.findUniqueById).mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project'
      } as any)

      const result = await batchEpisodeGenerator.generateBatch({
        projectId: 'proj-1',
        startEpisode: 2,
        targetEpisodes: 5
      })

      expect(result.generatedCount).toBe(4)
      expect(result.totalEpisodes).toBe(5)
      expect(result.failedCount).toBe(0)
    })
  })
})
