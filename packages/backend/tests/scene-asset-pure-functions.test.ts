import { describe, it, expect } from 'vitest'
import {
  analyzeSceneRequirements,
  generateCompositePrompt,
  getReferenceImageUrls
} from '../src/services/scene-asset.js'
import type { ScriptScene } from '@dreamer/shared/types'

describe('scene-asset pure functions', () => {
  describe('analyzeSceneRequirements', () => {
    it('identifies character requirements', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Office',
        timeOfDay: 'morning',
        characters: ['Alice', 'Bob'],
        description: 'Meeting scene',
        dialogues: [],
        actions: []
      }

      const result = analyzeSceneRequirements(scene)

      expect(result.requiredTypes).toContain('character')
      expect(result.suggestedAssets).toContainEqual(
        expect.objectContaining({
          type: 'character',
          description: expect.stringContaining('Alice')
        })
      )
      expect(result.priority).toBe(3)
    })

    it('identifies background requirements', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Cafe',
        timeOfDay: 'afternoon',
        characters: [],
        description: 'Empty cafe',
        dialogues: [],
        actions: []
      }

      const result = analyzeSceneRequirements(scene)

      expect(result.requiredTypes).toContain('background')
      expect(result.suggestedAssets).toContainEqual(
        expect.objectContaining({
          type: 'background',
          description: expect.stringContaining('Cafe')
        })
      )
    })

    it('identifies atmosphere requirements', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Park',
        timeOfDay: 'evening',
        characters: ['Alice'],
        description: 'Peaceful evening',
        dialogues: [],
        actions: []
      }

      const result = analyzeSceneRequirements(scene)

      expect(result.requiredTypes).toContain('atmosphere')
      expect(result.suggestedAssets).toContainEqual(
        expect.objectContaining({
          type: 'atmosphere',
          description: expect.stringContaining('evening')
        })
      )
    })

    it('detects style keywords in description', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'City',
        timeOfDay: 'night',
        characters: ['Hero'],
        description: 'A 科幻 city with futuristic buildings',
        dialogues: [],
        actions: []
      }

      const result = analyzeSceneRequirements(scene)

      expect(result.requiredTypes).toContain('style')
      expect(result.suggestedAssets).toContainEqual(
        expect.objectContaining({
          type: 'style',
          description: expect.stringContaining('科幻')
        })
      )
    })

    it('handles scene with no characters', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Empty Room',
        timeOfDay: 'day',
        characters: [],
        description: 'An empty room',
        dialogues: [],
        actions: []
      }

      const result = analyzeSceneRequirements(scene)

      expect(result.requiredTypes).not.toContain('character')
      expect(result.priority).toBeLessThan(3)
    })

    it('handles scene with all elements', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Ancient Temple',
        timeOfDay: 'dusk',
        characters: ['Monk', 'Warrior'],
        description: 'A 古风 temple in the mountains',
        dialogues: [],
        actions: []
      }

      const result = analyzeSceneRequirements(scene)

      expect(result.requiredTypes).toContain('character')
      expect(result.requiredTypes).toContain('background')
      expect(result.requiredTypes).toContain('atmosphere')
      expect(result.requiredTypes).toContain('style')
      expect(result.priority).toBe(3)
    })

    it('considers sceneActions for atmosphere description', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Beach',
        timeOfDay: 'sunset',
        characters: ['Couple'],
        description: 'Romantic scene',
        dialogues: [],
        actions: []
      }

      const sceneActions = { videoStyle: 'romantic' } as any
      const result = analyzeSceneRequirements(scene, sceneActions)

      expect(result.suggestedAssets).toContainEqual(
        expect.objectContaining({
          description: expect.stringContaining('romantic')
        })
      )
    })
  })

  describe('generateCompositePrompt', () => {
    it('generates prompt with scene info', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Office',
        timeOfDay: 'morning',
        characters: ['Alice'],
        description: 'Meeting',
        dialogues: [],
        actions: []
      }

      const result = generateCompositePrompt(scene, [])

      expect(result).toContain('Office')
      expect(result).toContain('morning')
    })

    it('includes character assets in prompt', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Office',
        timeOfDay: 'morning',
        characters: ['Alice'],
        description: 'Meeting',
        dialogues: [],
        actions: []
      }

      const assets = [{ type: 'character' as const, description: 'Alice in business suit' }]

      const result = generateCompositePrompt(scene, assets)

      expect(result).toContain('Alice in business suit')
    })

    it('includes background assets in prompt', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Office',
        timeOfDay: 'morning',
        characters: [],
        description: 'Empty office',
        dialogues: [],
        actions: []
      }

      const assets = [{ type: 'background' as const, description: 'Modern office with desks' }]

      const result = generateCompositePrompt(scene, assets)

      expect(result).toContain('Modern office with desks')
    })

    it('includes atmosphere mood in prompt', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Beach',
        timeOfDay: 'sunset',
        characters: [],
        description: 'Peaceful',
        dialogues: [],
        actions: []
      }

      const assets = [
        { type: 'atmosphere' as const, description: 'Atmosphere', mood: ['sunset', 'peaceful'] }
      ]

      const result = generateCompositePrompt(scene, assets)

      expect(result).toContain('sunset')
      expect(result).toContain('peaceful')
    })

    it('combines multiple asset types', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Castle',
        timeOfDay: 'night',
        characters: ['Knight'],
        description: 'Dark castle',
        dialogues: [],
        actions: []
      }

      const assets = [
        { type: 'character' as const, description: 'Knight in armor' },
        { type: 'background' as const, description: 'Medieval castle' },
        { type: 'atmosphere' as const, description: 'Dark atmosphere', mood: ['night', 'dark'] }
      ]

      const result = generateCompositePrompt(scene, assets)

      expect(result).toContain('Knight in armor')
      expect(result).toContain('Medieval castle')
      expect(result).toContain('night')
    })

    it('handles empty assets array', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Room',
        timeOfDay: 'day',
        characters: [],
        description: 'Simple room',
        dialogues: [],
        actions: []
      }

      const result = generateCompositePrompt(scene, [])

      expect(result).toContain('Room')
      expect(result).toContain('day')
      expect(result.split('。').length).toBe(2) // One sentence + trailing period
    })

    it('filters out assets without descriptions', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: 'Office',
        timeOfDay: 'day',
        characters: [],
        description: 'Office',
        dialogues: [],
        actions: []
      }

      const assets = [
        { type: 'character' as const, description: '' },
        { type: 'character' as const, description: 'Valid character' }
      ]

      const result = generateCompositePrompt(scene, assets)

      expect(result).toContain('Valid character')
      expect(result).not.toContain('，，') // No double commas from empty descriptions
    })
  })

  describe('getReferenceImageUrls', () => {
    it('extracts URLs from recommendations', () => {
      const recommendations = [
        {
          recommendedAssets: [
            { asset: { url: 'https://example.com/img1.jpg' } },
            { asset: { url: 'https://example.com/img2.jpg' } }
          ]
        }
      ]

      const result = getReferenceImageUrls(recommendations as any)

      expect(result).toHaveLength(2)
      expect(result).toContain('https://example.com/img1.jpg')
      expect(result).toContain('https://example.com/img2.jpg')
    })

    it('respects maxImages limit', () => {
      const recommendations = [
        {
          recommendedAssets: [
            { asset: { url: 'https://example.com/img1.jpg' } },
            { asset: { url: 'https://example.com/img2.jpg' } },
            { asset: { url: 'https://example.com/img3.jpg' } }
          ]
        }
      ]

      const result = getReferenceImageUrls(recommendations as any, 2)

      expect(result).toHaveLength(2)
    })

    it('skips assets without URLs', () => {
      const recommendations = [
        {
          recommendedAssets: [
            { asset: { url: '' } },
            { asset: { url: 'https://example.com/valid.jpg' } },
            { asset: {} }
          ]
        }
      ]

      const result = getReferenceImageUrls(recommendations as any)

      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://example.com/valid.jpg')
    })

    it('handles empty recommendations', () => {
      const result = getReferenceImageUrls([])

      expect(result).toHaveLength(0)
    })
  })
})
