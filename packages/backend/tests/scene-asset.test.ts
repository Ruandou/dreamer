import { describe, it, expect } from 'vitest'
import {
  analyzeSceneRequirements,
  matchAssets,
  generateCompositePrompt,
  suggestAssetGeneration,
  matchAssetsForScenes,
  convertCharacterImagesToAssets,
  getReferenceImageUrls
} from '../src/services/scene-asset.js'
import type { ProjectAsset } from '../src/services/scene-asset.js'
import type { ScriptScene, SceneAsset } from '@dreamer/shared/types'

function makeScene(overrides: Partial<ScriptScene> = {}): ScriptScene {
  return {
    sceneNum: 1,
    location: '客厅',
    timeOfDay: '日',
    characters: ['Alice'],
    description: '现代风格的客厅',
    dialogues: [],
    actions: [],
    ...overrides
  }
}

describe('analyzeSceneRequirements', () => {
  it('analyzes scene with all elements', () => {
    const result = analyzeSceneRequirements(makeScene())
    expect(result.requiredTypes).toContain('character')
    expect(result.requiredTypes).toContain('background')
    expect(result.requiredTypes).toContain('atmosphere')
    expect(result.suggestedAssets.length).toBeGreaterThan(0)
  })

  it('analyzes scene without characters', () => {
    const result = analyzeSceneRequirements(makeScene({ characters: [] }))
    expect(result.requiredTypes).not.toContain('character')
  })

  it('analyzes scene without location', () => {
    const result = analyzeSceneRequirements(makeScene({ location: '' }))
    expect(result.requiredTypes).not.toContain('background')
  })

  it('analyzes scene with style keywords', () => {
    const result = analyzeSceneRequirements(makeScene({ description: '古风庭院' }))
    expect(result.requiredTypes).toContain('style')
  })
})

describe('matchAssets', () => {
  const projectAssets: ProjectAsset[] = [
    { id: 'a1', type: 'character', name: 'Alice', url: 'http://img/1', description: 'Alice形象' },
    { id: 'a2', type: 'background', name: '客厅', url: 'http://bg/1', location: '客厅' },
    { id: 'a3', type: 'atmosphere', name: '白天', url: 'http://atm/1', mood: ['日'] },
    { id: 'a4', type: 'style', name: '现代', url: 'http://style/1', tags: ['modern'] }
  ]

  it('matches character assets', () => {
    const result = matchAssets(makeScene(), projectAssets)
    expect(result.recommendedAssets.length).toBeGreaterThan(0)
    expect(result.compositePrompt).toContain('场景')
  })

  it('limits assets by maxAssetsPerScene', () => {
    const result = matchAssets(makeScene(), projectAssets, undefined, { maxAssetsPerScene: 2 })
    expect(result.recommendedAssets.length).toBeLessThanOrEqual(2)
  })

  it('matches style assets with videoStyle', () => {
    const result = matchAssets(makeScene(), projectAssets, {
      sceneNum: 1,
      actions: [],
      suggestedDuration: 5,
      videoStyle: 'mixed'
    })
    expect(result.recommendedAssets.length).toBeGreaterThan(0)
  })
})

describe('generateCompositePrompt', () => {
  it('generates prompt with assets', () => {
    const assets: SceneAsset[] = [
      { id: '1', type: 'character', url: 'http://img/1', description: 'Alice' },
      { id: '2', type: 'background', url: 'http://bg/1', description: '客厅' }
    ]
    const result = generateCompositePrompt(makeScene(), assets)
    expect(result).toContain('场景')
    expect(result).toContain('Alice')
  })

  it('generates prompt without assets', () => {
    const result = generateCompositePrompt(makeScene(), [])
    expect(result).toContain('场景')
  })
})

describe('suggestAssetGeneration', () => {
  it('suggests assets for scene', () => {
    const result = suggestAssetGeneration(makeScene())
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('assetType')
    expect(result[0]).toHaveProperty('prompt')
  })
})

describe('calculateLocationRelevance', () => {
  it('returns exact match', () => {
    const result = matchAssets(makeScene({ location: '客厅' }), [
      { id: '1', type: 'background', name: '客厅', url: 'http://bg/1', location: '客厅' }
    ])
    expect(result.recommendedAssets.length).toBeGreaterThan(0)
  })

  it('returns contains match', () => {
    const result = matchAssets(makeScene({ location: '客厅' }), [
      { id: '1', type: 'background', name: '大客厅', url: 'http://bg/1', location: '大客厅' }
    ])
    expect(result.recommendedAssets.length).toBeGreaterThan(0)
  })

  it('handles empty asset location', () => {
    const result = matchAssets(makeScene({ location: '客厅' }), [
      { id: '1', type: 'background', name: 'bg', url: 'http://bg/1' }
    ])
    expect(result.recommendedAssets.length).toBeGreaterThan(0)
  })
})

describe('matchAssetsForScenes', () => {
  it('matches assets for multiple scenes', () => {
    const scenes = [makeScene(), makeScene({ sceneNum: 2 })]
    const result = matchAssetsForScenes(scenes, [])
    expect(result).toHaveLength(2)
  })
})

describe('convertCharacterImagesToAssets', () => {
  it('converts character images', () => {
    const images = [
      { id: 'img-1', name: 'Alice', avatarUrl: 'http://img/1', description: 'desc', type: 'base' }
    ]
    const result = convertCharacterImagesToAssets(images as any)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('character')
  })
})

describe('getReferenceImageUrls', () => {
  it('extracts URLs from recommendations', () => {
    const recommendations = [
      {
        sceneNum: 1,
        recommendedAssets: [
          {
            asset: {
              id: '1',
              type: 'character' as const,
              url: 'http://img/1',
              description: 'Alice'
            },
            relevance: 1,
            usage: 'reference' as const
          }
        ]
      }
    ]
    const result = getReferenceImageUrls(recommendations)
    expect(result).toContain('http://img/1')
  })

  it('limits URLs by maxImages', () => {
    const recommendations = [
      {
        sceneNum: 1,
        recommendedAssets: Array.from({ length: 15 }, (_, i) => ({
          asset: {
            id: `${i}`,
            type: 'character' as const,
            url: `http://img/${i}`,
            description: 'img'
          },
          relevance: 1,
          usage: 'reference' as const
        }))
      }
    ]
    const result = getReferenceImageUrls(recommendations, 5)
    expect(result.length).toBeLessThanOrEqual(5)
  })
})
