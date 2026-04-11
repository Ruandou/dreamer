import { describe, it, expect } from 'vitest'
import { generateStoryboard, exportStoryboardAsText } from '../src/services/storyboard-generator.js'
import type { EpisodePlan, ScriptScene } from '@dreamer/shared/types'

describe('Storyboard Generator Service', () => {
  describe('generateStoryboard', () => {
    it('should generate storyboard from episode', () => {
      const episodePlan: EpisodePlan = {
        episodeNum: 1,
        title: '第1集',
        synopsis: '测试集',
        sceneCount: 2,
        estimatedDuration: 24,
        keyMoments: [],
        sceneIndices: [0, 1]
      }

      const scenes: ScriptScene[] = [
        {
          sceneNum: 1,
          location: '办公室',
          timeOfDay: '日',
          characters: ['主角'],
          description: '主角走进办公室',
          dialogues: [],
          actions: ['走进办公室']
        },
        {
          sceneNum: 2,
          location: '会议室',
          timeOfDay: '日',
          characters: ['主角', '同事'],
          description: '主角和同事开会',
          dialogues: [{ character: '主角', content: '开始吧' }],
          actions: ['坐下']
        }
      ]

      const result = generateStoryboard(episodePlan, scenes)

      expect(result.length).toBe(2)
      expect(result[0].episodeNum).toBe(1)
      expect(result[0].segmentNum).toBe(1)
      expect(result[0].seedancePrompt).toBeTruthy()
    })
  })

  describe('exportStoryboardAsText', () => {
    it('should export storyboard as text', () => {
      const segments = [
        {
          episodeNum: 1,
          segmentNum: 1,
          description: '场景描述',
          duration: 10,
          aspectRatio: '9:16' as const,
          characters: [{ name: '主角', actions: [], referenceImageUrl: undefined }],
          location: '办公室',
          timeOfDay: '日',
          visualStyle: '现代',
          cameraMovement: '跟踪',
          specialEffects: [],
          seedancePrompt: '测试提示词',
          sceneAssets: [],
          compositeImageUrls: []
        }
      ]

      const result = exportStoryboardAsText(segments)

      expect(result).toContain('分镜 1-1')
      expect(result).toContain('时长：10秒')
      expect(result).toContain('测试提示词')
    })
  })
})
