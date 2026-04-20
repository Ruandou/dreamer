/**
 * 剧本解析性能基准测试
 * 测试优化后的批量操作和并行AI调用的性能提升
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runParseScriptEntityPipeline } from '../src/services/parse-script-entity-pipeline.js'
import { applyScriptVisualEnrichment } from '../src/services/script-visual-enrich.js'
import { projectRepository } from '../src/repositories/project-repository.js'
import { characterRepository } from '../src/repositories/character-repository.js'
import { episodeRepository } from '../src/repositories/episode-repository.js'
import { locationRepository } from '../src/repositories/location-repository.js'
import type { ScriptContent, ScriptScene } from '@dreamer/shared/types'

// Mock all external dependencies
vi.mock('../src/repositories/project-repository.js')
vi.mock('../src/repositories/character-repository.js')
vi.mock('../src/repositories/episode-repository.js')
vi.mock('../src/repositories/location-repository.js')
vi.mock('../src/services/ai/character-identity-merge.js', () => ({
  fetchCharacterIdentityMerge: vi.fn().mockResolvedValue({
    result: {
      characters: [],
      aliasToCanonical: {}
    },
    cost: { costCNY: 0.01, tokens: 100 }
  })
}))
vi.mock('../src/services/ai/deepseek.js', () => ({
  fetchScriptVisualEnrichmentJson: vi.fn().mockResolvedValue({
    jsonText: JSON.stringify({ locations: [], characters: [] })
  }),
  generateCharacterSlotImagePrompt: vi.fn().mockResolvedValue({
    prompt: 'Test prompt for character image'
  })
}))

const mockProjectRepository = vi.mocked(projectRepository)
const mockCharacterRepository = vi.mocked(characterRepository)
const mockEpisodeRepository = vi.mocked(episodeRepository)
const mockLocationRepository = vi.mocked(locationRepository)

describe('Script Parsing Performance Benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** 生成测试用的剧本数据 */
  function generateTestScript(
    episodeNum: number,
    sceneCount: number,
    characterCount: number
  ): ScriptContent {
    const characters = Array.from({ length: characterCount }, (_, i) => `角色${i + 1}`)
    const scenes: ScriptScene[] = Array.from({ length: sceneCount }, (_, i) => ({
      sceneNum: i + 1,
      location: `场景${(i % 5) + 1}`,
      timeOfDay: i % 2 === 0 ? '日' : '夜',
      characters: characters.slice(0, Math.min(3, characterCount)),
      description: `这是第${episodeNum}集的第${i + 1}个场景的描述文本，包含详细的场景信息和动作描述。`,
      dialogues: [
        { character: characters[0], content: '这是一段对话内容' },
        {
          character: characters[1 % characterCount],
          content: '这是另一段对话内容'
        }
      ],
      actions: ['角色走向门口', '打开门', '走出去']
    }))

    return {
      title: `测试剧本第${episodeNum}集`,
      summary: `这是第${episodeNum}集的剧情概要`,
      scenes
    }
  }

  /** 设置模拟数据 */
  function setupMockData(
    episodeCount: number,
    scenesPerEpisode: number,
    characterCount: number,
    locationCount: number
  ) {
    const projectId = 'test-project-123'
    const userId = 'test-user-456'

    // Mock episodes
    const episodes = Array.from({ length: episodeCount }, (_, i) => ({
      id: `episode-${i + 1}`,
      episodeNum: i + 1,
      title: `第${i + 1}集`,
      script: generateTestScript(i + 1, scenesPerEpisode, characterCount)
    }))

    mockProjectRepository.findUniqueWithEpisodesOrdered.mockResolvedValue({
      id: projectId,
      userId,
      name: '测试项目',
      description: '这是一个测试项目',
      episodes,
      visualStyle: ['电影质感'],
      synopsis: '测试 Synopsis',
      storyContext: '测试 Context'
    } as any)

    mockProjectRepository.findUserIdAndVisualStyle.mockResolvedValue({
      userId,
      visualStyle: ['电影质感']
    })

    // Mock characters
    const characters = Array.from({ length: characterCount }, (_, i) => ({
      id: `char-${i + 1}`,
      name: `角色${i + 1}`,
      description: `这是角色${i + 1}的描述`,
      projectId,
      images: [
        {
          id: `img-base-${i + 1}`,
          characterId: `char-${i + 1}`,
          name: '基础形象',
          type: 'base',
          parentId: null,
          description: '基础形象描述',
          prompt: null,
          order: 0
        },
        {
          id: `img-outfit-${i + 1}`,
          characterId: `char-${i + 1}`,
          name: '常服',
          type: 'outfit',
          parentId: `img-base-${i + 1}`,
          description: '常服描述',
          prompt: null,
          order: 1
        }
      ]
    }))

    mockCharacterRepository.findManyByProject.mockResolvedValue(characters as any)
    mockCharacterRepository.findManyByProjectNameAscWithImages.mockResolvedValue(characters as any)
    mockCharacterRepository.findManyByProjectAndNames.mockResolvedValue(characters as any)
    mockCharacterRepository.findImagesByCharacterIds.mockResolvedValue(
      characters.flatMap((c) => c.images) as any
    )
    mockCharacterRepository.findFirstByProjectAndName.mockImplementation((async (
      _proj: string,
      name: string
    ) => {
      return characters.find((c) => c.name === name) || null
    }) as any)
    mockCharacterRepository.updateManyCharacterDescriptions.mockResolvedValue([])
    mockCharacterRepository.deleteManyCharacters.mockResolvedValue({
      count: 0
    })
    mockCharacterRepository.createManyCharacterImages.mockResolvedValue({
      count: 0
    })
    mockCharacterRepository.createCharacterImage.mockImplementation(async (data: any) => ({
      id: `img-new-${Date.now()}`,
      ...data
    }))
    mockCharacterRepository.maxSiblingOrder.mockResolvedValue({
      _max: { order: 0 }
    })
    mockCharacterRepository.updateCharacterImage.mockResolvedValue({} as any)
    mockCharacterRepository.findFirstBaseImage.mockResolvedValue(null)

    // Mock locations
    const locations = Array.from({ length: locationCount }, (_, i) => ({
      id: `loc-${i + 1}`,
      name: `场景${i + 1}`,
      description: `场景${i + 1}的描述`,
      projectId,
      timeOfDay: '日',
      imagePrompt: null
    }))

    mockLocationRepository.findManyByProjectOrdered.mockResolvedValue(locations as any)
    mockLocationRepository.updateManyActiveImagePromptByProjectAndName.mockResolvedValue({
      count: 1
    })

    // Mock episode updates
    mockEpisodeRepository.update.mockResolvedValue({} as any)

    return { projectId, userId, episodes, characters, locations }
  }

  describe('Performance with different scales', () => {
    it('should process small project (5 episodes, 10 scenes, 5 chars) efficiently', async () => {
      const { projectId, userId } = setupMockData(5, 10, 5, 5)

      const start = performance.now()
      const merged = await runParseScriptEntityPipeline(projectId, userId, 5)
      const duration = performance.now() - start

      console.log(`\n📊 Small Project (5 episodes, 10 scenes/ep, 5 chars):`)
      console.log(`   Duration: ${duration.toFixed(2)}ms`)
      console.log(`   Merged scenes: ${merged.scenes.length}`)

      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
      expect(merged.scenes.length).toBe(50) // 5 episodes × 10 scenes
    })

    it('should process medium project (20 episodes, 15 scenes, 15 chars) efficiently', async () => {
      const { projectId, userId } = setupMockData(20, 15, 15, 10)

      const start = performance.now()
      const merged = await runParseScriptEntityPipeline(projectId, userId, 20)
      const duration = performance.now() - start

      console.log(`\n📊 Medium Project (20 episodes, 15 scenes/ep, 15 chars):`)
      console.log(`   Duration: ${duration.toFixed(2)}ms`)
      console.log(`   Merged scenes: ${merged.scenes.length}`)

      expect(duration).toBeLessThan(2000) // Should complete in under 2 seconds
      expect(merged.scenes.length).toBe(300) // 20 × 15
    })

    it('should process large project (36 episodes, 20 scenes, 20 chars) efficiently', async () => {
      const { projectId, userId } = setupMockData(36, 20, 20, 15)

      const start = performance.now()
      const merged = await runParseScriptEntityPipeline(projectId, userId, 36)
      const duration = performance.now() - start

      console.log(`\n📊 Large Project (36 episodes, 20 scenes/ep, 20 chars):`)
      console.log(`   Duration: ${duration.toFixed(2)}ms`)
      console.log(`   Merged scenes: ${merged.scenes.length}`)

      expect(duration).toBeLessThan(3000) // Should complete in under 3 seconds
      expect(merged.scenes.length).toBe(720) // 36 × 20
    })

    it('should verify batch operations are called (not N+1 queries)', async () => {
      const { projectId, userId } = setupMockData(20, 15, 15, 10)

      await runParseScriptEntityPipeline(projectId, userId, 20)

      // Verify batch methods are used
      expect(mockCharacterRepository.findManyByProjectAndNames).toHaveBeenCalled()
      expect(mockCharacterRepository.findImagesByCharacterIds).toHaveBeenCalled()

      // These should NOT be called repeatedly in a loop
      const findFirstCalls = mockCharacterRepository.findFirstByProjectAndName.mock.calls.length
      console.log(`\n🔍 N+1 Query Check:`)
      console.log(`   findFirstByProjectAndName calls: ${findFirstCalls}`)
      console.log(`   Batch methods used: ✓`)

      // With optimization, findFirstByProjectAndName should only be called for alias deletion
      // (once per alias, not for every character operation)
      expect(findFirstCalls).toBeLessThan(30) // Reasonable bound for alias operations
    })

    it('should handle visual enrichment with parallel prompt generation', async () => {
      const { projectId } = setupMockData(10, 10, 10, 5)
      const script = generateTestScript(1, 10, 10)

      const start = performance.now()
      await applyScriptVisualEnrichment(projectId, script)
      const duration = performance.now() - start

      console.log(`\n📊 Visual Enrichment (10 characters with missing prompts):`)
      console.log(`   Duration: ${duration.toFixed(2)}ms`)

      // Should use parallel processing
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Optimization verification', () => {
    it('should not re-fetch project after normalization', async () => {
      const { projectId, userId } = setupMockData(10, 10, 10, 5)

      await runParseScriptEntityPipeline(projectId, userId, 10)

      // Should only call findUniqueWithEpisodesOrdered once
      const projectFetchCalls =
        mockProjectRepository.findUniqueWithEpisodesOrdered.mock.calls.length
      console.log(`\n✅ Redundant Query Check:`)
      console.log(`   Project fetch calls: ${projectFetchCalls} (should be 1)`)

      expect(projectFetchCalls).toBe(1)
    })

    it('should use batch delete for alias characters', async () => {
      const { projectId, userId } = setupMockData(10, 10, 10, 5)

      // Add alias characters to the mock
      const aliasCharacters = [
        { id: 'alias-1', name: '别名1', description: 'Alias 1', projectId },
        { id: 'alias-2', name: '别名2', description: 'Alias 2', projectId },
        { id: 'alias-3', name: '别名3', description: 'Alias 3', projectId }
      ]

      mockCharacterRepository.findManyByProjectAndNames.mockImplementation((async (
        _proj: string,
        names: string[]
      ) => {
        const allChars = [
          {
            id: 'char-1',
            name: '角色1',
            description: 'Character 1',
            projectId
          },
          ...aliasCharacters
        ]
        return allChars.filter((c) => names.includes(c.name))
      }) as any)

      // Override the mock to return alias mappings
      const mergeModule = await import('../src/services/ai/character-identity-merge.js')
      vi.spyOn(mergeModule, 'fetchCharacterIdentityMerge').mockResolvedValue({
        result: {
          characters: [{ name: '角色1', description: 'Test', images: [] }],
          aliasToCanonical: {
            别名1: '角色1',
            别名2: '角色1',
            别名3: '角色1'
          }
        },
        cost: {
          costCNY: 0.01,
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150
        }
      })

      await runParseScriptEntityPipeline(projectId, userId, 10)

      // Should use batch delete
      expect(mockCharacterRepository.deleteManyCharacters).toHaveBeenCalled()
      console.log(`\n✅ Batch Operations:`)
      console.log(`   Batch delete called: ✓`)
    })

    it('should use batch update for character descriptions', async () => {
      const { projectId, userId } = setupMockData(10, 10, 10, 5)

      await runParseScriptEntityPipeline(projectId, userId, 10)

      // Should use batch update
      expect(mockCharacterRepository.updateManyCharacterDescriptions).toHaveBeenCalled()
      console.log(`\n✅ Batch Operations:`)
      console.log(`   Batch update called: ✓`)
    })
  })
})
