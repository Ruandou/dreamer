import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isCrowdExtraCharacterName,
  collectUniqueCharacterNamesFromScript,
  saveCharacters,
  saveLocations
} from '../src/services/script-entities.js'
import type { ScriptContent } from '@dreamer/shared/types'

// Mock repositories
vi.mock('../src/repositories/character-repository.js', () => ({
  characterRepository: {
    upsertPlaceholderByProjectName: vi.fn().mockResolvedValue({ id: 'char-1' })
  }
}))

vi.mock('../src/repositories/location-repository.js', () => ({
  locationRepository: {
    upsertFromScriptScene: vi.fn().mockResolvedValue({ id: 'loc-1' })
  }
}))

const mockCharacterRepository = vi.mocked(
  (await import('../src/repositories/character-repository.js')).characterRepository
)
const mockLocationRepository = vi.mocked(
  (await import('../src/repositories/location-repository.js')).locationRepository
)

describe('script-entities', () => {
  describe('isCrowdExtraCharacterName', () => {
    it('returns true for exact matches', () => {
      expect(isCrowdExtraCharacterName('群演')).toBe(true)
      expect(isCrowdExtraCharacterName('群众')).toBe(true)
      expect(isCrowdExtraCharacterName('群众演员')).toBe(true)
      expect(isCrowdExtraCharacterName('路人')).toBe(true)
      expect(isCrowdExtraCharacterName('龙套')).toBe(true)
      expect(isCrowdExtraCharacterName('npc')).toBe(true)
      expect(isCrowdExtraCharacterName('NPC')).toBe(true)
    })

    it('returns true for English crowd terms', () => {
      expect(isCrowdExtraCharacterName('extras')).toBe(true)
      expect(isCrowdExtraCharacterName('crowd')).toBe(true)
      expect(isCrowdExtraCharacterName('EXTRAS')).toBe(true)
    })

    it('returns true for 群演 with number suffix', () => {
      expect(isCrowdExtraCharacterName('群演1')).toBe(true)
      expect(isCrowdExtraCharacterName('群演2')).toBe(true)
      expect(isCrowdExtraCharacterName('群演10')).toBe(true)
      expect(isCrowdExtraCharacterName('群演100')).toBe(true)
    })

    it('returns true for 路人 with Chinese character suffix', () => {
      expect(isCrowdExtraCharacterName('路人甲')).toBe(true)
      expect(isCrowdExtraCharacterName('路人乙')).toBe(true)
      expect(isCrowdExtraCharacterName('路人丙')).toBe(true)
      expect(isCrowdExtraCharacterName('路人丁')).toBe(true)
    })

    it('returns false for named characters', () => {
      expect(isCrowdExtraCharacterName('Alice')).toBe(false)
      expect(isCrowdExtraCharacterName('张三')).toBe(false)
      expect(isCrowdExtraCharacterName('李四')).toBe(false)
    })

    it('returns false for crowd terms with additional words', () => {
      expect(isCrowdExtraCharacterName('群演队长')).toBe(false)
      expect(isCrowdExtraCharacterName('路人A')).toBe(false)
    })

    it('returns true for empty or whitespace strings', () => {
      expect(isCrowdExtraCharacterName('')).toBe(true)
      expect(isCrowdExtraCharacterName('   ')).toBe(true)
    })
  })

  describe('collectUniqueCharacterNamesFromScript', () => {
    it('collects unique character names from scenes', () => {
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
          },
          {
            sceneNum: 2,
            location: 'Cafe',
            timeOfDay: 'afternoon',
            characters: ['Alice', 'Charlie'],
            description: 'Coffee',
            dialogues: [],
            actions: []
          }
        ]
      }

      const result = collectUniqueCharacterNamesFromScript(script)

      expect(result).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('excludes crowd extra characters', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Street',
            timeOfDay: 'day',
            characters: ['Alice', '群演', '路人甲', 'Bob'],
            description: 'Scene',
            dialogues: [
              { character: 'Alice', content: 'Hello' },
              { character: '群演', content: '...' }
            ],
            actions: []
          }
        ]
      }

      const result = collectUniqueCharacterNamesFromScript(script)

      expect(result).toEqual(['Alice', 'Bob'])
    })

    it('collects from both characters and dialogues', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Room',
            timeOfDay: 'day',
            characters: ['Alice'],
            description: 'Scene',
            dialogues: [
              { character: 'Bob', content: 'Hi' },
              { character: 'Charlie', content: 'Hello' }
            ],
            actions: []
          }
        ]
      }

      const result = collectUniqueCharacterNamesFromScript(script)

      expect(result).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('handles empty scenes array', () => {
      const script: ScriptContent = {
        title: 'Empty',
        summary: 'No scenes',
        scenes: []
      }

      const result = collectUniqueCharacterNamesFromScript(script)

      expect(result).toEqual([])
    })

    it('handles missing characters and dialogues arrays', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Room',
            timeOfDay: 'day',
            description: 'Scene'
          } as any
        ]
      }

      const result = collectUniqueCharacterNamesFromScript(script)

      expect(result).toEqual([])
    })

    it('sorts result alphabetically', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Room',
            timeOfDay: 'day',
            characters: ['Charlie', 'Alice', 'Bob'],
            description: 'Scene',
            dialogues: [],
            actions: []
          }
        ]
      }

      const result = collectUniqueCharacterNamesFromScript(script)

      expect(result).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('trims whitespace from character names', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Room',
            timeOfDay: 'day',
            characters: ['  Alice  ', 'Bob'],
            description: 'Scene',
            dialogues: [{ character: '  Charlie  ', content: 'Hi' }],
            actions: []
          }
        ]
      }

      const result = collectUniqueCharacterNamesFromScript(script)

      expect(result).toEqual(['Alice', 'Bob', 'Charlie'])
    })
  })

  describe('saveCharacters', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('saves characters from script scenes', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice', 'Bob'],
            description: 'Scene',
            dialogues: [],
            actions: []
          }
        ]
      }

      await saveCharacters('proj-1', script)

      expect(mockCharacterRepository.upsertPlaceholderByProjectName).toHaveBeenCalledTimes(2)
      expect(mockCharacterRepository.upsertPlaceholderByProjectName).toHaveBeenCalledWith(
        'proj-1',
        'Alice'
      )
      expect(mockCharacterRepository.upsertPlaceholderByProjectName).toHaveBeenCalledWith(
        'proj-1',
        'Bob'
      )
    })

    it('handles undefined scenes gracefully', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: undefined as any
      }

      await saveCharacters('proj-1', script)

      expect(mockCharacterRepository.upsertPlaceholderByProjectName).not.toHaveBeenCalled()
    })

    it('handles empty scenes array', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: []
      }

      await saveCharacters('proj-1', script)

      expect(mockCharacterRepository.upsertPlaceholderByProjectName).not.toHaveBeenCalled()
    })

    it('excludes crowd extra characters', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Street',
            timeOfDay: 'day',
            characters: ['Alice', '群演', '路人甲'],
            description: 'Scene',
            dialogues: [],
            actions: []
          }
        ]
      }

      await saveCharacters('proj-1', script)

      expect(mockCharacterRepository.upsertPlaceholderByProjectName).toHaveBeenCalledTimes(1)
      expect(mockCharacterRepository.upsertPlaceholderByProjectName).toHaveBeenCalledWith(
        'proj-1',
        'Alice'
      )
    })
  })

  describe('saveLocations', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('saves locations from script scenes', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: '咖啡厅',
            timeOfDay: '日',
            characters: ['Alice'],
            description: '内景',
            dialogues: [],
            actions: []
          },
          {
            sceneNum: 2,
            location: '花园',
            timeOfDay: '夜',
            characters: ['Bob'],
            description: '外景',
            dialogues: [],
            actions: []
          }
        ]
      }

      await saveLocations('proj-1', script)

      expect(mockLocationRepository.upsertFromScriptScene).toHaveBeenCalledTimes(2)
      expect(mockLocationRepository.upsertFromScriptScene).toHaveBeenCalledWith(
        'proj-1',
        '咖啡厅',
        { timeOfDay: '日', description: '内景' }
      )
      expect(mockLocationRepository.upsertFromScriptScene).toHaveBeenCalledWith('proj-1', '花园', {
        timeOfDay: '夜',
        description: '外景'
      })
    })

    it('handles undefined scenes gracefully', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: undefined as any
      }

      await saveLocations('proj-1', script)

      expect(mockLocationRepository.upsertFromScriptScene).not.toHaveBeenCalled()
    })

    it('handles empty scenes array', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: []
      }

      await saveLocations('proj-1', script)

      expect(mockLocationRepository.upsertFromScriptScene).not.toHaveBeenCalled()
    })

    it('deduplicates locations with same name', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: '咖啡厅',
            timeOfDay: '日',
            characters: ['Alice'],
            description: '第一次出现',
            dialogues: [],
            actions: []
          },
          {
            sceneNum: 2,
            location: '咖啡厅',
            timeOfDay: '夜',
            characters: ['Bob'],
            description: '第二次出现',
            dialogues: [],
            actions: []
          }
        ]
      }

      await saveLocations('proj-1', script)

      expect(mockLocationRepository.upsertFromScriptScene).toHaveBeenCalledTimes(1)
      expect(mockLocationRepository.upsertFromScriptScene).toHaveBeenCalledWith(
        'proj-1',
        '咖啡厅',
        { timeOfDay: '日', description: '第一次出现' }
      )
    })

    it('skips scenes without location', async () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: '',
            timeOfDay: '日',
            characters: ['Alice'],
            description: '无场地',
            dialogues: [],
            actions: []
          }
        ]
      }

      await saveLocations('proj-1', script)

      expect(mockLocationRepository.upsertFromScriptScene).not.toHaveBeenCalled()
    })
  })
})
