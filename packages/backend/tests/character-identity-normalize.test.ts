import { describe, it, expect } from 'vitest'
import { normalizeScriptContent } from '../src/services/character-identity-normalize.js'
import type { ScriptContent } from '@dreamer/shared/types'

describe('character-identity-normalize', () => {
  describe('normalizeScriptContent', () => {
    it('returns original script when aliasToCanonical is empty', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test script',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'morning',
            characters: ['Alice', 'Bob'],
            description: 'Meeting',
            dialogues: [],
            actions: []
          }
        ]
      }

      const result = normalizeScriptContent(script, {})

      expect(result).toBe(script)
    })

    it('returns original script when aliasToCanonical is null', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: []
      }

      const result = normalizeScriptContent(script, null as any)

      expect(result).toBe(script)
    })

    it('replaces character names in scene.characters', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice', 'Bob', 'Charlie'],
            description: 'Scene',
            dialogues: [],
            actions: []
          }
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith',
        'Bob': 'Bob Jones'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].characters).toEqual(['Alice Smith', 'Bob Jones', 'Charlie'])
    })

    it('replaces character names in dialogues', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice'],
            description: 'Scene',
            dialogues: [
              { character: 'Alice', content: 'Hello' },
              { character: 'Bob', content: 'Hi' }
            ],
            actions: []
          }
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith',
        'Bob': 'Bob Jones'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].dialogues[0].character).toBe('Alice Smith')
      expect(result.scenes[0].dialogues[1].character).toBe('Bob Jones')
    })

    it('deduplicates characters after replacement', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice', 'Alice Smith', 'Bob'],
            description: 'Scene',
            dialogues: [],
            actions: []
          }
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      // Both 'Alice' and 'Alice Smith' should become 'Alice Smith', deduplicated
      expect(result.scenes[0].characters).toEqual(['Alice Smith', 'Bob'])
    })

    it('replaces names in metadata.characters', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [],
        metadata: {
          characters: ['Alice', 'Bob', 'Charlie']
        }
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith',
        'Bob': 'Bob Jones'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.metadata?.characters).toEqual(['Alice Smith', 'Bob Jones', 'Charlie'])
    })

    it('deduplicates metadata.characters after replacement', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [],
        metadata: {
          characters: ['Alice', 'Alice Smith']
        }
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.metadata?.characters).toEqual(['Alice Smith'])
    })

    it('handles empty scenes array', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: []
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes).toEqual([])
    })

    it('handles missing characters array in scene', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            description: 'Scene without characters'
          } as any
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].characters).toEqual([])
    })

    it('handles missing dialogues array in scene', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice']
          } as any
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].dialogues).toEqual([])
    })

    it('handles missing metadata', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: []
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.metadata).toBeUndefined()
    })

    it('trims whitespace before matching', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['  Alice  ', 'Bob'],
            description: 'Scene',
            dialogues: [
              { character: '  Alice  ', content: 'Hello' }
            ],
            actions: []
          }
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].characters[0]).toBe('Alice Smith')
      expect(result.scenes[0].dialogues[0].character).toBe('Alice Smith')
    })

    it('keeps original name when not in alias map', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice', 'Unknown'],
            description: 'Scene',
            dialogues: [
              { character: 'Unknown', content: 'Hello' }
            ],
            actions: []
          }
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].characters).toEqual(['Alice Smith', 'Unknown'])
      expect(result.scenes[0].dialogues[0].character).toBe('Unknown')
    })

    it('handles multiple scenes', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'morning',
            characters: ['Alice'],
            description: 'Morning',
            dialogues: [],
            actions: []
          },
          {
            sceneNum: 2,
            location: 'Cafe',
            timeOfDay: 'afternoon',
            characters: ['Bob'],
            description: 'Afternoon',
            dialogues: [],
            actions: []
          },
          {
            sceneNum: 3,
            location: 'Park',
            timeOfDay: 'evening',
            characters: ['Alice', 'Bob'],
            description: 'Evening',
            dialogues: [],
            actions: []
          }
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith',
        'Bob': 'Bob Jones'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].characters).toEqual(['Alice Smith'])
      expect(result.scenes[1].characters).toEqual(['Bob Jones'])
      expect(result.scenes[2].characters).toEqual(['Alice Smith', 'Bob Jones'])
    })

    it('preserves other scene properties', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice'],
            description: 'Important scene',
            dialogues: [],
            actions: ['enter', 'sit']
          }
        ]
      }

      const aliasToCanonical = {
        'Alice': 'Alice Smith'
      }

      const result = normalizeScriptContent(script, aliasToCanonical)

      expect(result.scenes[0].sceneNum).toBe(1)
      expect(result.scenes[0].location).toBe('Office')
      expect(result.scenes[0].timeOfDay).toBe('day')
      expect(result.scenes[0].description).toBe('Important scene')
      expect(result.scenes[0].actions).toEqual(['enter', 'sit'])
    })
  })
})
