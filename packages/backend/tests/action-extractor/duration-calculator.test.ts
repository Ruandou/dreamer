import { describe, it, expect } from 'vitest'
import {
  calculateSuggestedDuration,
  DURATION_LIMITS
} from '../../src/services/action-extractor/duration-calculator.ts'
import type { ScriptScene, CharacterAction } from '@dreamer/shared/types'

describe('Duration Calculator', () => {
  describe('DURATION_LIMITS', () => {
    it('should have correct minimum duration', () => {
      expect(DURATION_LIMITS.MIN).toBe(4)
    })

    it('should have correct maximum duration', () => {
      expect(DURATION_LIMITS.MAX).toBe(15)
    })

    it('should have base duration', () => {
      expect(DURATION_LIMITS.BASE).toBe(5)
    })
  })

  describe('calculateSuggestedDuration', () => {
    it('should calculate based on dialogue count', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '办公室',
        timeOfDay: '日',
        characters: ['A', 'B'],
        description: '对话',
        dialogues: [
          { character: 'A', content: '你好' },
          { character: 'B', content: '你好' },
          { character: 'A', content: '最近怎么样' }
        ],
        actions: []
      }

      const actions: CharacterAction[] = [
        { actionType: 'dialogue', description: '说话', characterName: 'A' },
        { actionType: 'dialogue', description: '说话', characterName: 'B' },
        { actionType: 'dialogue', description: '说话', characterName: 'A' }
      ]

      const duration = calculateSuggestedDuration(scene, actions)
      expect(duration).toBeGreaterThanOrEqual(DURATION_LIMITS.MIN)
      expect(duration).toBeLessThanOrEqual(DURATION_LIMITS.MAX)
    })

    it('should calculate based on action count', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '街道',
        timeOfDay: '日',
        characters: ['A'],
        description: '动作场景',
        dialogues: [],
        actions: ['奔跑', '跳跃', '转身', '离开']
      }

      const actions: CharacterAction[] = [
        { actionType: 'movement', description: '奔跑', characterName: 'A' },
        { actionType: 'movement', description: '跳跃', characterName: 'A' },
        { actionType: 'movement', description: '转身', characterName: 'A' },
        { actionType: 'movement', description: '离开', characterName: 'A' }
      ]

      const duration = calculateSuggestedDuration(scene, actions)
      expect(duration).toBeGreaterThanOrEqual(DURATION_LIMITS.MIN)
      expect(duration).toBeLessThanOrEqual(DURATION_LIMITS.MAX)
    })

    it('should return base duration for empty scenes', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '空房间',
        timeOfDay: '日',
        characters: [],
        description: '',
        dialogues: [],
        actions: []
      }

      expect(calculateSuggestedDuration(scene, [])).toBe(DURATION_LIMITS.BASE)
    })

    it('should cap at maximum duration', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '大厅',
        timeOfDay: '日',
        characters: ['A', 'B', 'C', 'D'],
        description: '复杂场景',
        dialogues: Array(20)
          .fill(null)
          .map((_, i) => ({
            character: `角色${i}`,
            content: `台词${i}`
          })),
        actions: Array(10)
          .fill(null)
          .map((_, i) => `动作${i}`)
      }

      const actions: CharacterAction[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          actionType: 'movement' as const,
          description: `动作${i}`,
          characterName: 'A'
        }))

      const duration = calculateSuggestedDuration(scene, actions)
      expect(duration).toBeLessThanOrEqual(DURATION_LIMITS.MAX)
    })

    it('should handle scenes with only description', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '花园',
        timeOfDay: '日',
        characters: ['A'],
        description: '一个美丽的花园，花开满园',
        dialogues: [],
        actions: []
      }

      const duration = calculateSuggestedDuration(scene, [])
      expect(duration).toBeGreaterThanOrEqual(DURATION_LIMITS.MIN)
    })
  })
})
