import { describe, it, expect } from 'vitest'
import { extractActionsFromScene } from '../src/services/action-extractor.js'
import type { ScriptScene } from '@dreamer/shared/types'

describe('Action Extractor Service', () => {
  describe('extractActionsFromScene', () => {
    it('should extract actions from a scene', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '办公室',
        timeOfDay: '日',
        characters: ['主角'],
        description: '主角走进办公室，坐下',
        dialogues: [{ character: '主角', content: '今天的工作真多啊' }],
        actions: ['走进办公室', '坐下']
      }

      const result = extractActionsFromScene(scene)

      expect(result.sceneNum).toBe(1)
      expect(result.actions.length).toBeGreaterThan(0)
      expect(result.suggestedDuration).toBeGreaterThanOrEqual(4)
      expect(result.suggestedDuration).toBeLessThanOrEqual(15)
    })

    it('should determine video style correctly', () => {
      const dialogueScene: ScriptScene = {
        sceneNum: 1,
        location: '咖啡厅',
        timeOfDay: '日',
        characters: ['A', 'B'],
        description: '两人对话',
        dialogues: [
          { character: 'A', content: '你好' },
          { character: 'B', content: '你好' },
          { character: 'A', content: '最近怎么样' },
          { character: 'B', content: '还行' }
        ],
        actions: []
      }

      const result = extractActionsFromScene(dialogueScene)
      expect(result.videoStyle).toBe('dialogue')
    })

    it('should suggest correct aspect ratio', () => {
      const scene: ScriptScene = {
        sceneNum: 1,
        location: '室内',
        timeOfDay: '日',
        characters: ['角色'],
        description: '场景描述',
        dialogues: [],
        actions: []
      }

      const result = extractActionsFromScene(scene)
      expect(result.suggestedAspectRatio).toBe('9:16') // 默认竖屏
    })
  })
})
