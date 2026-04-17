import { describe, it, expect } from 'vitest'
import {
  splitIntoEpisodes,
  calculateEpisodeDuration,
  calculateTotalDuration
} from '../src/services/episode-splitter.js'
import type { ScriptContent } from '@dreamer/shared/types'

describe('Episode Splitter Service', () => {
  describe('splitIntoEpisodes', () => {
    it('should split a script into episodes', () => {
      const script: ScriptContent = {
        title: '测试剧本',
        summary: '测试',
        scenes: [
          {
            sceneNum: 1,
            location: '办公室',
            timeOfDay: '日',
            characters: ['角色1'],
            description: '场景1描述',
            dialogues: [],
            actions: ['动作1']
          },
          {
            sceneNum: 2,
            location: '街道',
            timeOfDay: '夜',
            characters: ['角色2'],
            description: '场景2描述',
            dialogues: [],
            actions: ['动作2']
          },
          {
            sceneNum: 3,
            location: '商场',
            timeOfDay: '日',
            characters: ['角色1', '角色2'],
            description: '场景3描述',
            dialogues: [],
            actions: ['动作3']
          }
        ]
      }

      const episodes = splitIntoEpisodes(script, { targetDuration: 30 })

      expect(episodes.length).toBeGreaterThan(0)
      expect(episodes[0].title).toContain('第1集')
      expect(episodes[0].estimatedDuration).toBeGreaterThan(0)
    })

    it('should handle single scene script', () => {
      const script: ScriptContent = {
        title: '单场景剧本',
        summary: '测试',
        scenes: [
          {
            sceneNum: 1,
            location: '室内',
            timeOfDay: '日',
            characters: ['角色1'],
            description: '场景描述',
            dialogues: [],
            actions: []
          }
        ]
      }

      const episodes = splitIntoEpisodes(script)

      expect(episodes.length).toBe(1)
      expect(episodes[0].sceneCount).toBe(1)
    })
  })

  describe('calculateEpisodeDuration', () => {
    it('should calculate duration correctly', () => {
      const duration = calculateEpisodeDuration(5)
      expect(duration).toBe(60) // 5 scenes * 12 seconds
    })
  })

  describe('calculateTotalDuration', () => {
    it('should calculate total duration', () => {
      const episodes = [
        {
          episodeNum: 1,
          title: '第1集',
          synopsis: '',
          sceneCount: 3,
          estimatedDuration: 36,
          keyMoments: []
        },
        {
          episodeNum: 2,
          title: '第2集',
          synopsis: '',
          sceneCount: 2,
          estimatedDuration: 24,
          keyMoments: []
        }
      ]

      const total = calculateTotalDuration(episodes)
      expect(total).toBe(60)
    })
  })
})
