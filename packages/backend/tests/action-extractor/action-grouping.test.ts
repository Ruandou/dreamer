import { describe, it, expect } from 'vitest'
import {
  groupActionsByCharacter,
  mergeSceneActions
} from '../../src/services/action-extractor/action-grouping.ts'

describe('Action Grouping', () => {
  describe('groupActionsByCharacter', () => {
    it('should group actions by character name and limit per character', () => {
      const actions = [
        { actionType: 'movement' as const, description: '走进房间', characterName: 'Alice' },
        { actionType: 'expression' as const, description: '微笑', characterName: 'Bob' },
        { actionType: 'reaction' as const, description: '挥手', characterName: 'Alice' },
        { actionType: 'movement' as const, description: '坐下', characterName: 'Alice' }
      ]

      const result = groupActionsByCharacter(actions, 2)

      // Alice should have only 2 actions (limited)
      const aliceActions = result.filter((a) => a.characterName === 'Alice')
      const bobActions = result.filter((a) => a.characterName === 'Bob')

      expect(aliceActions.length).toBe(2)
      expect(bobActions.length).toBe(1)
      expect(result.length).toBe(3)
    })

    it('should handle empty actions array', () => {
      const result = groupActionsByCharacter([], 3)
      expect(result.length).toBe(0)
    })

    it('should not limit if under maxPerCharacter', () => {
      const actions = [{ actionType: 'movement' as const, description: '走路', characterName: 'A' }]

      const result = groupActionsByCharacter(actions, 5)
      expect(result.length).toBe(1)
    })
  })

  describe('mergeSceneActions', () => {
    it('should merge multiple scene actions', () => {
      const scene1 = {
        actions: [{ actionType: 'movement' as const, description: '走路', characterName: 'A' }]
      }

      const scene2 = {
        actions: [{ actionType: 'expression' as const, description: '微笑', characterName: 'B' }]
      }

      const result = mergeSceneActions([scene1, scene2])

      expect(result.length).toBe(2)
    })

    it('should handle empty scenes array', () => {
      const result = mergeSceneActions([])
      expect(result.length).toBe(0)
    })

    it('should deduplicate similar actions', () => {
      const scenes = [
        {
          actions: [
            { actionType: 'movement' as const, description: '走路到门口', characterName: 'A' }
          ]
        },
        {
          actions: [
            { actionType: 'movement' as const, description: '走路到门口', characterName: 'A' }
          ]
        }
      ]

      const result = mergeSceneActions(scenes)
      expect(result.length).toBe(1)
    })
  })
})
