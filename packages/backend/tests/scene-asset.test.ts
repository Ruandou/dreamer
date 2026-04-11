import { describe, it, expect } from 'vitest'
import { analyzeSceneRequirements, matchAssets, getReferenceImageUrls } from '../src/services/scene-asset.js'
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
              asset: { type: 'character' as const, description: '1', url: 'https://example.com/1.png' },
              relevance: 0.9,
              usage: 'reference' as const
            },
            {
              asset: { type: 'character' as const, description: '2', url: 'https://example.com/2.png' },
              relevance: 0.9,
              usage: 'reference' as const
            },
            {
              asset: { type: 'character' as const, description: '3', url: 'https://example.com/3.png' },
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
})
