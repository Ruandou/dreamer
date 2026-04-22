/**
 * ScriptParser 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scriptParser } from '../../src/services/script-processing/script-parser.js'
import { projectRepository } from '../../src/repositories/project-repository.js'
import { generateVisualStyleConfig } from '../../src/services/ai/visual-style-generator.js'

vi.mock('../../src/repositories/project-repository.js', () => ({
  projectRepository: {
    findUniqueWithEpisodesOrdered: vi.fn(),
    update: vi.fn()
  }
}))

vi.mock('../../src/services/ai/visual-style-generator.js', () => ({
  generateVisualStyleConfig: vi.fn()
}))

describe('ScriptParser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseAndSync', () => {
    it('should throw error when project not found', async () => {
      vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue(null)

      await expect(
        scriptParser.parseAndSync({
          projectId: 'non-existent',
          userId: 'user-1',
          episodes: []
        })
      ).rejects.toThrow('项目不存在')
    })

    it('should generate visualStyleConfig when missing', async () => {
      const mockProject = {
        id: 'proj-1',
        userId: 'user-1',
        name: 'Test Project',
        description: 'Test description',
        synopsis: 'Test synopsis',
        visualStyleConfig: null,
        episodes: []
      }

      vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue(
        mockProject as any
      )
      vi.mocked(generateVisualStyleConfig).mockResolvedValue({
        era: 'modern',
        artStyle: ['photorealistic'],
        colorMood: ['warm'],
        quality: 'high'
      })

      const result = await scriptParser.parseAndSync({
        projectId: 'proj-1',
        userId: 'user-1',
        episodes: []
      })

      expect(generateVisualStyleConfig).toHaveBeenCalled()
      expect(projectRepository.update).toHaveBeenCalled()
      expect(result.parsedCount).toBe(0)
    })

    it('should skip visualStyleConfig generation when exists', async () => {
      const mockProject = {
        id: 'proj-1',
        userId: 'user-1',
        name: 'Test Project',
        description: 'Test description',
        synopsis: 'Test synopsis',
        visualStyleConfig: {
          era: 'modern',
          artStyle: ['anime'],
          colorMood: ['warm'],
          quality: 'high'
        },
        episodes: [
          { id: 'ep-1', episodeNum: 1, script: { title: 'Ep1', summary: 'S1', scenes: [] } },
          { id: 'ep-2', episodeNum: 2, script: { title: 'Ep2', summary: 'S2', scenes: [] } }
        ]
      }

      vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue(
        mockProject as any
      )

      const result = await scriptParser.parseAndSync({
        projectId: 'proj-1',
        userId: 'user-1',
        episodes: []
      })

      expect(generateVisualStyleConfig).not.toHaveBeenCalled()
      expect(result.parsedCount).toBe(2)
      expect(result.failedCount).toBe(0)
    })

    it('should count episodes with script content', async () => {
      const mockProject = {
        id: 'proj-1',
        userId: 'user-1',
        name: 'Test Project',
        description: 'Test',
        synopsis: 'Synopsis',
        visualStyleConfig: {
          era: 'modern',
          artStyle: ['photorealistic'],
          colorMood: ['cool'],
          quality: 'high'
        },
        episodes: [
          { id: 'ep-1', episodeNum: 1, script: { title: 'Ep1', summary: 'S1', scenes: [] } },
          { id: 'ep-2', episodeNum: 2, script: null },
          { id: 'ep-3', episodeNum: 3, script: { title: 'Ep3', summary: 'S3', scenes: [] } }
        ]
      }

      vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue(
        mockProject as any
      )

      const result = await scriptParser.parseAndSync({
        projectId: 'proj-1',
        userId: 'user-1',
        episodes: []
      })

      expect(result.parsedCount).toBe(2)
    })
  })

  describe('parseEpisode', () => {
    it('should return ok true for successful parse', async () => {
      const result = await scriptParser.parseEpisode('proj-1', 1, 'Episode content')

      expect(result.ok).toBe(true)
    })
  })
})
