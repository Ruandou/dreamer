import { describe, it, expect, vi } from 'vitest'
import { runParseScriptEntityPipeline } from '../src/services/parse-script-entity-pipeline.js'
import { projectRepository } from '../src/repositories/project-repository.js'
import { episodeRepository } from '../src/repositories/episode-repository.js'
import { characterRepository } from '../src/repositories/character-repository.js'
import { fetchCharacterIdentityMerge } from '../src/services/ai/character-identity-merge.js'

vi.mock('../src/repositories/project-repository.js', () => ({
  projectRepository: {
    findUniqueWithEpisodesOrdered: vi.fn()
  }
}))

vi.mock('../src/repositories/episode-repository.js', () => ({
  episodeRepository: {
    update: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('../src/repositories/character-repository.js', () => ({
  characterRepository: {
    findManyByProjectAndNames: vi.fn().mockResolvedValue([]),
    deleteManyCharacters: vi.fn().mockResolvedValue({ count: 0 }),
    updateManyCharacterDescriptions: vi.fn().mockResolvedValue([]),
    findManyByProject: vi.fn().mockResolvedValue([]),
    findImagesByCharacterIds: vi.fn().mockResolvedValue([]),
    createManyCharacterImages: vi.fn().mockResolvedValue({ count: 0 }),
    maxSiblingOrder: vi.fn().mockResolvedValue({ _max: { order: null } })
  }
}))

vi.mock('../src/services/ai/character-identity-merge.js', () => ({
  fetchCharacterIdentityMerge: vi.fn()
}))

vi.mock('../src/services/script-entities.js', () => ({
  saveCharacters: vi.fn().mockResolvedValue(undefined),
  saveLocations: vi.fn().mockResolvedValue(undefined),
  collectUniqueCharacterNamesFromScript: vi.fn().mockReturnValue([])
}))

describe('runParseScriptEntityPipeline', () => {
  it('throws when project not found', async () => {
    vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue(null)
    await expect(runParseScriptEntityPipeline('proj-1', 'user-1', 36)).rejects.toThrow('项目不存在')
  })

  it('runs successfully with empty project', async () => {
    vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue({
      id: 'proj-1',
      episodes: []
    } as any)

    const result = await runParseScriptEntityPipeline('proj-1', 'user-1', 36)
    expect(result).toBeDefined()
    expect(result.scenes).toEqual([])
  })

  it('runs with episodes but no characters', async () => {
    vi.mocked(projectRepository.findUniqueWithEpisodesOrdered).mockResolvedValue({
      id: 'proj-1',
      episodes: [
        {
          id: 'ep-1',
          episodeNum: 1,
          title: '第一集',
          script: { title: '第一集', summary: '', scenes: [] }
        }
      ]
    } as any)

    const result = await runParseScriptEntityPipeline('proj-1', 'user-1', 36)
    expect(result).toBeDefined()
  })
})
