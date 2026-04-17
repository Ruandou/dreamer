import { describe, it, expect } from 'vitest'
import {
  analyzeSceneRequirements,
  matchAssets,
  getReferenceImageUrls,
  generateCompositePrompt,
  suggestAssetGeneration,
  matchAssetsForScenes,
  convertCharacterImagesToAssets
} from '../src/services/scene-asset.js'
import type { ScriptScene } from '@dreamer/shared/types'

describe('Scene Asset Service', () => {
  describe('analyzeSceneRequirements', () => {
    it('should analyze scene requirements', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '古代宫殿',
        timeOfDay: '夜',
        characters: ['皇帝', '皇后'],
        description: '古风宫殿场景',
        dialogues: [],
        actions: []
      }

      const result = analyzeSceneRequirements(scene)

      expect(result.requiredTypes).toContain('character')
      expect(result.requiredTypes).toContain('background')
      expect(result.requiredTypes).toContain('atmosphere')
    })
  })

  describe('matchAssets', () => {
    it('should match assets to scene', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '办公室',
        timeOfDay: '日',
        characters: ['员工'],
        description: '办公室场景',
        dialogues: [],
        actions: []
      }

      const projectAssets = [
        {
          id: '1',
          type: 'character' as const,
          name: '员工A',
          url: 'https://example.com/employee.png',
          description: '员工形象'
        }
      ]

      const result = matchAssets(scene, projectAssets)

      expect(result.sceneNum).toBe(1)
      expect(result.recommendedAssets.length).toBeGreaterThan(0)
    })
  })

  describe('getReferenceImageUrls', () => {
    it('should collect image URLs', () => {
      const recommendations = [
        {
          sceneNum: 1,
          recommendedAssets: [
            {
              asset: {
                type: 'character' as const,
                description: '角色',
                url: 'https://example.com/1.png'
              },
              relevance: 0.9,
              usage: 'reference' as const
            },
            {
              asset: {
                type: 'background' as const,
                description: '背景',
                url: 'https://example.com/2.png'
              },
              relevance: 0.8,
              usage: 'background' as const
            }
          ]
        }
      ]

      const urls = getReferenceImageUrls(recommendations)
      expect(urls.length).toBe(2)
      expect(urls).toContain('https://example.com/1.png')
    })

    it('should limit to max images', () => {
      const recommendations = [
        {
          sceneNum: 1,
          recommendedAssets: [
            {
              asset: {
                type: 'character' as const,
                description: '1',
                url: 'https://example.com/1.png'
              },
              relevance: 0.9,
              usage: 'reference' as const
            },
            {
              asset: {
                type: 'character' as const,
                description: '2',
                url: 'https://example.com/2.png'
              },
              relevance: 0.9,
              usage: 'reference' as const
            },
            {
              asset: {
                type: 'character' as const,
                description: '3',
                url: 'https://example.com/3.png'
              },
              relevance: 0.9,
              usage: 'reference' as const
            }
          ]
        }
      ]

      const urls = getReferenceImageUrls(recommendations, 2)
      expect(urls.length).toBe(2)
    })
  })

  describe('generateCompositePrompt', () => {
    it('joins scene label and asset descriptions', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '海边',
        timeOfDay: '昏',
        characters: [],
        description: '落日',
        dialogues: [],
        actions: []
      }
      const prompt = generateCompositePrompt(scene, [
        { id: '1', type: 'character', name: 'a', url: '', description: '男主', tags: [] },
        {
          id: '2',
          type: 'atmosphere',
          name: 'm',
          url: '',
          description: 'x',
          mood: ['暖色调']
        }
      ])
      expect(prompt).toContain('海边')
      expect(prompt).toContain('男主')
      expect(prompt).toContain('暖色调')
    })
  })

  describe('suggestAssetGeneration', () => {
    it('returns sorted suggestions by priority', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '城',
        timeOfDay: '夜',
        characters: ['路人'],
        description: '现代街道',
        dialogues: [],
        actions: []
      }
      const s = suggestAssetGeneration(scene)
      expect(s[0].priority).toBeGreaterThanOrEqual(s[s.length - 1].priority)
      expect(s.some((x) => x.assetType === 'character')).toBe(true)
      expect(s.some((x) => x.assetType === 'background')).toBe(true)
    })
  })

  describe('matchAssetsForScenes', () => {
    it('matches each scene with optional actions', () => {
      const scenes: ScriptScene[] = [
        {
          sceneNum: 1,
          location: 'L1',
          timeOfDay: '日',
          characters: ['A'],
          description: 'd',
          dialogues: [],
          actions: []
        },
        {
          sceneNum: 2,
          location: 'L2',
          timeOfDay: '夜',
          characters: [],
          description: 'd2',
          dialogues: [],
          actions: []
        }
      ]
      const assets = [
        { id: 'x', type: 'character' as const, name: 'n', url: 'u', description: 'A' }
      ]
      const recs = matchAssetsForScenes(scenes, assets)
      expect(recs).toHaveLength(2)
      expect(recs[0].sceneNum).toBe(1)
      expect(recs[1].sceneNum).toBe(2)
    })
  })

  describe('convertCharacterImagesToAssets', () => {
    it('maps images to project assets', () => {
      const out = convertCharacterImagesToAssets([
        {
          id: 'img-1',
          characterId: 'c1',
          name: '定妆',
          type: 'base',
          order: 0,
          avatarUrl: 'https://x/a.png',
          description: '正面',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
      expect(out[0]).toMatchObject({
        id: 'img-1',
        type: 'character',
        url: 'https://x/a.png',
        description: '正面',
        tags: ['base']
      })
    })
  })
})
