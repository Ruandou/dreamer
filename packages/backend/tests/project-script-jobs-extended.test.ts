import { describe, it, expect } from 'vitest'
import {
  scriptFromJson,
  mergeEpisodesToScriptContent,
  DEFAULT_TARGET_EPISODES
} from '../src/services/project-script-jobs.js'

describe('project-script-jobs helpers extended', () => {
  describe('scriptFromJson', () => {
    it('returns null for null input', () => {
      expect(scriptFromJson(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(scriptFromJson(undefined)).toBeNull()
    })

    it('returns null for non-object', () => {
      expect(scriptFromJson('string')).toBeNull()
      expect(scriptFromJson(123)).toBeNull()
      expect(scriptFromJson(true)).toBeNull()
    })

    it('returns null when scenes is not an array', () => {
      expect(scriptFromJson({ scenes: 'not array' })).toBeNull()
      expect(scriptFromJson({ scenes: null })).toBeNull()
      expect(scriptFromJson({})).toBeNull()
    })

    it('returns ScriptContent when valid', () => {
      const script = {
        title: 'Test',
        summary: 'Test script',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice'],
            description: 'Scene',
            dialogues: [],
            actions: []
          }
        ]
      }

      const result = scriptFromJson(script)

      expect(result).not.toBeNull()
      expect(result?.title).toBe('Test')
      expect(result?.scenes).toHaveLength(1)
    })

    it('accepts empty scenes array', () => {
      const script = {
        title: 'Empty',
        scenes: []
      }

      const result = scriptFromJson(script)

      expect(result).not.toBeNull()
      expect(result?.scenes).toEqual([])
    })
  })

  describe('mergeEpisodesToScriptContent extended', () => {
    it('uses first episode title and summary as base', () => {
      const episodes = [
        {
          episodeNum: 1,
          title: 'Episode 1',
          script: {
            title: 'Main Title',
            summary: 'Main Summary',
            scenes: [
              {
                sceneNum: 1,
                location: 'Office',
                timeOfDay: 'day',
                characters: ['Alice'],
                description: 'Scene 1',
                dialogues: [],
                actions: []
              }
            ]
          }
        }
      ]

      const result = mergeEpisodesToScriptContent(episodes as any)

      expect(result.title).toBe('Main Title')
      expect(result.summary).toBe('Main Summary')
      expect(result.scenes).toHaveLength(1)
      expect(result.scenes[0].sceneNum).toBe(1)
    })

    it('defaults to "剧本" when no valid script', () => {
      const episodes = [
        {
          episodeNum: 1,
          title: 'Episode 1',
          script: { invalid: true }
        }
      ]

      const result = mergeEpisodesToScriptContent(episodes as any)

      expect(result.title).toBe('剧本')
      expect(result.summary).toBe('')
      expect(result.scenes).toEqual([])
    })

    it('merges scenes from multiple episodes with sequential numbering', () => {
      const episodes = [
        {
          episodeNum: 2,
          title: 'Episode 2',
          script: {
            title: 'Ep2',
            summary: 'Summary 2',
            scenes: [
              {
                sceneNum: 1,
                location: 'Cafe',
                timeOfDay: 'afternoon',
                characters: ['Bob'],
                description: 'Scene A',
                dialogues: [],
                actions: []
              },
              {
                sceneNum: 2,
                location: 'Park',
                timeOfDay: 'evening',
                characters: ['Bob'],
                description: 'Scene B',
                dialogues: [],
                actions: []
              }
            ]
          }
        },
        {
          episodeNum: 1,
          title: 'Episode 1',
          script: {
            title: 'Ep1',
            summary: 'Summary 1',
            scenes: [
              {
                sceneNum: 1,
                location: 'Office',
                timeOfDay: 'morning',
                characters: ['Alice'],
                description: 'Scene 1',
                dialogues: [],
                actions: []
              }
            ]
          }
        }
      ]

      const result = mergeEpisodesToScriptContent(episodes as any)

      // Should be ordered by episodeNum
      expect(result.title).toBe('Ep1')
      expect(result.summary).toBe('Summary 1')
      expect(result.scenes).toHaveLength(3)
      expect(result.scenes[0].sceneNum).toBe(1)
      expect(result.scenes[0].location).toBe('Office')
      expect(result.scenes[1].sceneNum).toBe(2)
      expect(result.scenes[1].location).toBe('Cafe')
      expect(result.scenes[2].sceneNum).toBe(3)
      expect(result.scenes[2].location).toBe('Park')
    })

    it('skips episodes with invalid scripts', () => {
      const episodes = [
        {
          episodeNum: 1,
          title: 'Episode 1',
          script: {
            title: 'Ep1',
            summary: 'Summary 1',
            scenes: [
              {
                sceneNum: 1,
                location: 'Office',
                timeOfDay: 'day',
                characters: ['Alice'],
                description: 'Valid scene',
                dialogues: [],
                actions: []
              }
            ]
          }
        },
        {
          episodeNum: 2,
          title: 'Episode 2',
          script: { invalid: true }
        },
        {
          episodeNum: 3,
          title: 'Episode 3',
          script: {
            title: 'Ep3',
            summary: 'Summary 3',
            scenes: [
              {
                sceneNum: 1,
                location: 'Park',
                timeOfDay: 'evening',
                characters: ['Bob'],
                description: 'Another valid scene',
                dialogues: [],
                actions: []
              }
            ]
          }
        }
      ]

      const result = mergeEpisodesToScriptContent(episodes as any)

      expect(result.scenes).toHaveLength(2)
      expect(result.scenes[0].location).toBe('Office')
      expect(result.scenes[1].location).toBe('Park')
    })

    it('handles empty episodes array', () => {
      const result = mergeEpisodesToScriptContent([])

      expect(result.title).toBe('剧本')
      expect(result.summary).toBe('')
      expect(result.scenes).toEqual([])
    })

    it('uses episode title as fallback when script title is missing', () => {
      const episodes = [
        {
          episodeNum: 1,
          title: 'Episode Title',
          script: {
            summary: 'Summary',
            scenes: []
          }
        }
      ]

      const result = mergeEpisodesToScriptContent(episodes as any)

      expect(result.title).toBe('Episode Title')
    })

    it('preserves all scene properties during merge', () => {
      const episodes = [
        {
          episodeNum: 1,
          title: 'Episode 1',
          script: {
            title: 'Test',
            summary: 'Test',
            scenes: [
              {
                sceneNum: 1,
                location: 'Office',
                timeOfDay: 'morning',
                characters: ['Alice', 'Bob'],
                description: 'Meeting scene',
                dialogues: [{ character: 'Alice', content: 'Hello' }],
                actions: ['enter', 'sit']
              }
            ]
          }
        }
      ]

      const result = mergeEpisodesToScriptContent(episodes as any)

      expect(result.scenes[0].location).toBe('Office')
      expect(result.scenes[0].timeOfDay).toBe('morning')
      expect(result.scenes[0].characters).toEqual(['Alice', 'Bob'])
      expect(result.scenes[0].description).toBe('Meeting scene')
      expect(result.scenes[0].dialogues).toHaveLength(1)
      expect(result.scenes[0].actions).toEqual(['enter', 'sit'])
    })
  })

  describe('DEFAULT_TARGET_EPISODES', () => {
    it('is 36', () => {
      expect(DEFAULT_TARGET_EPISODES).toBe(36)
    })
  })
})
