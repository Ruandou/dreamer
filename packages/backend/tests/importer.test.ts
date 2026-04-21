import { describe, it, expect, vi } from 'vitest'
import { importParsedData } from '../src/services/importer.js'
import { projectRepository } from '../src/repositories/project-repository.js'
import { characterRepository } from '../src/repositories/character-repository.js'
import { episodeRepository } from '../src/repositories/episode-repository.js'

vi.mock('../src/repositories/project-repository.js', () => ({
  projectRepository: {
    findAspectRatioSelect: vi.fn().mockResolvedValue({ aspectRatio: '9:16' })
  }
}))

vi.mock('../src/repositories/character-repository.js', () => ({
  characterRepository: {
    createCharacter: vi.fn().mockResolvedValue({ id: 'char-1' }),
    createCharacterImage: vi.fn().mockResolvedValue({ id: 'img-1' }),
    maxSiblingOrder: vi.fn().mockResolvedValue({ _max: { order: null } })
  }
}))

vi.mock('../src/repositories/episode-repository.js', () => ({
  episodeRepository: {
    findUniqueByProjectEpisodeWithScenes: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'ep-1' }),
    createScene: vi.fn().mockResolvedValue({ id: 'scene-1' }),
    createShot: vi.fn().mockResolvedValue({ id: 'shot-1' }),
    update: vi.fn().mockResolvedValue({}),
    deleteScenesByEpisode: vi.fn().mockResolvedValue({})
  }
}))

describe('importParsedData', () => {
  it('imports new episodes and characters', async () => {
    const parsed = {
      characters: [
        { name: 'Alice', description: '主角', images: [{ name: '基础形象', type: 'base' }] }
      ],
      episodes: [
        {
          episodeNum: 1,
          title: '第一集',
          script: { title: '第一集', scenes: [] },
          scenes: [{ sceneNum: 1, description: '场景1', prompt: 'prompt1' }]
        }
      ]
    }

    const result = await importParsedData('proj-1', parsed as any)
    expect(result.charactersCreated).toBe(1)
    expect(result.episodesCreated).toBe(1)
    expect(result.scenesCreated).toBe(1)
    expect(result.episodesUpdated).toBe(0)
  })

  it('updates existing episodes', async () => {
    vi.mocked(episodeRepository.findUniqueByProjectEpisodeWithScenes).mockResolvedValue({
      id: 'ep-existing'
    } as any)

    const parsed = {
      characters: [],
      episodes: [
        {
          episodeNum: 1,
          title: '第一集',
          script: { title: '第一集', scenes: [] },
          scenes: [{ sceneNum: 1, description: '场景1', prompt: 'prompt1' }]
        }
      ]
    }

    const result = await importParsedData('proj-1', parsed as any)
    expect(result.episodesUpdated).toBe(1)
    expect(result.episodesCreated).toBe(0)
  })

  it('creates derived images with base fallback', async () => {
    vi.mocked(characterRepository.createCharacterImage)
      .mockResolvedValueOnce({ id: 'base-img' } as any)
      .mockResolvedValueOnce({ id: 'derived-img' } as any)

    const parsed = {
      characters: [
        {
          name: 'Alice',
          description: '主角',
          images: [{ name: '表情1', type: 'expression' }]
        }
      ],
      episodes: []
    }

    const result = await importParsedData('proj-1', parsed as any)
    expect(result.charactersCreated).toBe(1)
  })

  it('handles character without description', async () => {
    const parsed = {
      characters: [{ name: 'Bob', images: [] }],
      episodes: []
    }

    const result = await importParsedData('proj-1', parsed as any)
    expect(result.charactersCreated).toBe(1)
  })
})
