import { describe, it, expect } from 'vitest'
import {
  getStepDescription,
  getPipelineSteps,
  estimatePipelineCost
} from '../src/services/pipeline-orchestrator.js'
import type { ScriptContent } from '@dreamer/shared/types'

describe('pipeline-orchestrator pure functions', () => {
  describe('getStepDescription', () => {
    it('returns description for script-writing step', () => {
      const desc = getStepDescription('script-writing')
      expect(desc).toContain('剧本生成')
      expect(desc).toContain('DeepSeek')
    })

    it('returns description for episode-splitting step', () => {
      const desc = getStepDescription('episode-splitting')
      expect(desc).toContain('智能分集')
      expect(desc).toContain('起承转合')
    })

    it('returns description for action-extraction step', () => {
      const desc = getStepDescription('action-extraction')
      expect(desc).toContain('动作提取')
      expect(desc).toContain('情绪')
    })

    it('returns description for asset-matching step', () => {
      const desc = getStepDescription('asset-matching')
      expect(desc).toContain('素材匹配')
      expect(desc).toContain('参考图')
    })

    it('returns description for storyboard-generation step', () => {
      const desc = getStepDescription('storyboard-generation')
      expect(desc).toContain('分镜生成')
      expect(desc).toContain('提示词')
    })

    it('returns description for seedance-parametrization step', () => {
      const desc = getStepDescription('seedance-parametrization')
      expect(desc).toContain('Seedance参数化')
      expect(desc).toContain('API')
    })

    it('returns description for video-generation step', () => {
      const desc = getStepDescription('video-generation')
      expect(desc).toContain('视频生成')
      expect(desc).toContain('Seedance')
    })

    it('returns 未知步骤 for unknown step', () => {
      const desc = getStepDescription('unknown-step' as any)
      expect(desc).toBe('未知步骤')
    })
  })

  describe('getPipelineSteps', () => {
    it('returns all pipeline steps in order', () => {
      const steps = getPipelineSteps()
      expect(steps).toHaveLength(7)
      expect(steps[0]).toBe('script-writing')
      expect(steps[1]).toBe('episode-splitting')
      expect(steps[2]).toBe('action-extraction')
      expect(steps[3]).toBe('asset-matching')
      expect(steps[4]).toBe('storyboard-generation')
      expect(steps[5]).toBe('seedance-parametrization')
      expect(steps[6]).toBe('video-generation')
    })

    it('returns steps in correct execution order', () => {
      const steps = getPipelineSteps()
      // Script writing must come before episode splitting
      expect(steps.indexOf('script-writing')).toBeLessThan(steps.indexOf('episode-splitting'))
      // Storyboard generation must come before video generation
      expect(steps.indexOf('storyboard-generation')).toBeLessThan(steps.indexOf('video-generation'))
    })

    it('returns a new array each time', () => {
      const steps1 = getPipelineSteps()
      const steps2 = getPipelineSteps()
      expect(steps1).not.toBe(steps2)
      expect(steps1).toEqual(steps2)
    })
  })

  describe('estimatePipelineCost', () => {
    it('calculates cost for single scene script', () => {
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
            dialogues: [],
            actions: []
          }
        ]
      }
      const seedanceConfigs = [{ duration: 5, prompt: 'Test prompt' }]

      const cost = estimatePipelineCost(script, seedanceConfigs as any)

      expect(cost.scriptCost).toBe(0.1) // 1 scene * 0.1
      expect(cost.videoCost).toBe(5) // 5 seconds * 1.0
      expect(cost.totalCost).toBe(5.1)
    })

    it('calculates cost for multi-scene script', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice'],
            description: 'Scene 1',
            dialogues: [],
            actions: []
          },
          {
            sceneNum: 2,
            location: 'Cafe',
            timeOfDay: 'afternoon',
            characters: ['Bob'],
            description: 'Scene 2',
            dialogues: [],
            actions: []
          },
          {
            sceneNum: 3,
            location: 'Park',
            timeOfDay: 'evening',
            characters: ['Alice', 'Bob'],
            description: 'Scene 3',
            dialogues: [],
            actions: []
          }
        ]
      }
      const seedanceConfigs = [
        { duration: 5, prompt: 'Prompt 1' },
        { duration: 8, prompt: 'Prompt 2' },
        { duration: 3, prompt: 'Prompt 3' }
      ]

      const cost = estimatePipelineCost(script, seedanceConfigs as any)

      expect(cost.scriptCost).toBeCloseTo(0.3, 1) // 3 scenes * 0.1
      expect(cost.videoCost).toBe(16) // (5 + 8 + 3) * 1.0
      expect(cost.totalCost).toBeCloseTo(16.3, 1)
    })

    it('handles empty scenes array', () => {
      const script: ScriptContent = {
        title: 'Empty',
        summary: 'No scenes',
        scenes: []
      }
      const seedanceConfigs: any[] = []

      const cost = estimatePipelineCost(script, seedanceConfigs)

      expect(cost.scriptCost).toBe(0)
      expect(cost.videoCost).toBe(0)
      expect(cost.totalCost).toBe(0)
    })

    it('handles zero duration configs', () => {
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
            dialogues: [],
            actions: []
          }
        ]
      }
      const seedanceConfigs = [{ duration: 0, prompt: 'Zero duration' }]

      const cost = estimatePipelineCost(script, seedanceConfigs as any)

      expect(cost.scriptCost).toBe(0.1)
      expect(cost.videoCost).toBe(0)
      expect(cost.totalCost).toBe(0.1)
    })

    it('calculates cost for long video segments', () => {
      const script: ScriptContent = {
        title: 'Test',
        summary: 'Test',
        scenes: [
          {
            sceneNum: 1,
            location: 'Office',
            timeOfDay: 'day',
            characters: ['Alice'],
            description: 'Long scene',
            dialogues: [],
            actions: []
          }
        ]
      }
      const seedanceConfigs = [
        { duration: 30, prompt: '30 second clip' },
        { duration: 45, prompt: '45 second clip' }
      ]

      const cost = estimatePipelineCost(script, seedanceConfigs as any)

      expect(cost.scriptCost).toBe(0.1)
      expect(cost.videoCost).toBe(75) // (30 + 45) * 1.0
      expect(cost.totalCost).toBe(75.1)
    })

    it('calculates cost with fractional durations', () => {
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
            dialogues: [],
            actions: []
          },
          {
            sceneNum: 2,
            location: 'Cafe',
            timeOfDay: 'day',
            characters: ['Bob'],
            description: 'Scene',
            dialogues: [],
            actions: []
          }
        ]
      }
      const seedanceConfigs = [
        { duration: 5.5, prompt: '5.5 seconds' },
        { duration: 3.2, prompt: '3.2 seconds' }
      ]

      const cost = estimatePipelineCost(script, seedanceConfigs as any)

      expect(cost.scriptCost).toBe(0.2)
      expect(cost.videoCost).toBeCloseTo(8.7, 1) // (5.5 + 3.2) * 1.0
      expect(cost.totalCost).toBeCloseTo(8.9, 1)
    })
  })
})
