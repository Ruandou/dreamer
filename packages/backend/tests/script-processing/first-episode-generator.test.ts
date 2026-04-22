/**
 * FirstEpisodeGenerator 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { firstEpisodeGenerator } from '../../src/services/script-processing/first-episode-generator.js'
import { projectRepository } from '../../src/repositories/project-repository.js'
import { formatScriptToJSON, writeScriptFromIdea } from '../../src/services/script-writer.js'
import { safeExtractAndSaveMemories } from '../../src/services/memory/index.js'

// Mock dependencies
vi.mock('../../src/repositories/project-repository.js', () => ({
  projectRepository: {
    findUniqueById: vi.fn(),
    update: vi.fn(),
    upsertEpisodeBatchFromScript: vi.fn(),
    upsertEpisodeFirstFromScript: vi.fn()
  }
}))

vi.mock('../../src/services/script-writer.js', () => ({
  formatScriptToJSON: vi.fn(),
  writeScriptFromIdea: vi.fn()
}))

vi.mock('../../src/services/memory/index.js', () => ({
  safeExtractAndSaveMemories: vi.fn()
}))

vi.mock('../../src/services/script-mode-detector.js', () => ({
  detectScriptMode: vi.fn()
}))

describe('FirstEpisodeGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generate - faithful-parse mode', () => {
    it('should parse all episodes from complete script', async () => {
      const mockProject = {
        id: 'proj-1',
        userId: 'user-1',
        description: '第一集 内容1\n\n第二集 内容2',
        name: 'Test Project',
        synopsis: null,
        storyContext: null,
        aspectRatio: null,
        visualStyle: [],
        visualStyleConfig: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(projectRepository.findUniqueById).mockResolvedValue(mockProject)

      const { detectScriptMode } = await import('../../src/services/script-mode-detector.js')
      vi.mocked(detectScriptMode).mockReturnValue({
        mode: 'faithful-parse',
        episodes: [
          { episodeNum: 1, content: '第一集内容', mode: 'faithful-parse', confidence: 1 },
          { episodeNum: 2, content: '第二集内容', mode: 'faithful-parse', confidence: 1 }
        ]
      })

      vi.mocked(formatScriptToJSON).mockResolvedValue({
        title: 'Test',
        summary: 'Summary',
        scenes: []
      })

      vi.mocked(projectRepository.upsertEpisodeBatchFromScript).mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        projectId: 'proj-1',
        script: {}
      } as any)

      const result = await firstEpisodeGenerator.generate({
        projectId: 'proj-1',
        targetEpisodes: 2
      })

      expect(result.episodeCount).toBe(2)
      expect(result.parsedCount).toBe(2)
      expect(result.failedCount).toBe(0)
      expect(formatScriptToJSON).toHaveBeenCalledTimes(2)
    })

    it('should throw error when no episodes parsed', async () => {
      const mockProject = {
        id: 'proj-1',
        userId: 'user-1',
        description: '测试',
        name: 'Test Project',
        synopsis: null,
        storyContext: null,
        aspectRatio: null,
        visualStyle: [],
        visualStyleConfig: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(projectRepository.findUniqueById).mockResolvedValue(mockProject)

      const { detectScriptMode } = await import('../../src/services/script-mode-detector.js')
      vi.mocked(detectScriptMode).mockReturnValue({
        mode: 'faithful-parse',
        episodes: [{ episodeNum: 1, mode: 'faithful-parse', confidence: 1 }]
      })

      await expect(firstEpisodeGenerator.generate({ projectId: 'proj-1' })).rejects.toThrow(
        '完整剧本解析失败'
      )
    })
  })

  describe('generate - AI creation mode', () => {
    it('should generate first episode using AI', async () => {
      const mockProject = {
        id: 'proj-1',
        userId: 'user-1',
        description: 'AI创意想法',
        name: 'Test Project',
        synopsis: null,
        storyContext: null,
        aspectRatio: null,
        visualStyle: [],
        visualStyleConfig: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(projectRepository.findUniqueById).mockResolvedValue(mockProject)

      const { detectScriptMode } = await import('../../src/services/script-mode-detector.js')
      vi.mocked(detectScriptMode).mockReturnValue({
        mode: 'ai-create'
      })

      vi.mocked(writeScriptFromIdea).mockResolvedValue({
        script: {
          title: 'AI Generated',
          summary: 'AI Summary',
          scenes: []
        },
        cost: { totalTokens: 300, costCNY: 0.01, inputTokens: 100, outputTokens: 200 }
      })

      vi.mocked(projectRepository.upsertEpisodeFirstFromScript).mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        projectId: 'proj-1',
        script: {}
      } as any)

      const result = await firstEpisodeGenerator.generate({
        projectId: 'proj-1'
      })

      expect(result.episodeCount).toBe(1)
      expect(result.parsedCount).toBe(1)
      expect(writeScriptFromIdea).toHaveBeenCalled()
      expect(safeExtractAndSaveMemories).toHaveBeenCalled()
    })
  })

  describe('generate - project not found', () => {
    it('should throw PROJECT_NOT_FOUND error', async () => {
      vi.mocked(projectRepository.findUniqueById).mockResolvedValue(null)

      await expect(firstEpisodeGenerator.generate({ projectId: 'non-existent' })).rejects.toThrow(
        'PROJECT_NOT_FOUND'
      )
    })
  })
})
