import { describe, it, expect } from 'vitest'
import {
  buildSeedanceConfig,
  validateSeedanceConfig,
  optimizePromptForSeedance,
  estimateSeedanceCost
} from '../src/services/seedance-optimizer.js'
import type { StoryboardSegment } from '@dreamer/shared/types'

describe('Seedance Optimizer Service', () => {
  describe('buildSeedanceConfig', () => {
    it('should build config from segment', () => {
      const segment: StoryboardSegment = {
        episodeNum: 1,
        segmentNum: 1,
        description: '测试场景',
        duration: 10,
        aspectRatio: '9:16',
        characters: [
          {
            name: '主角',
            actions: [],
            referenceImageUrl: 'https://example.com/char.png'
          }
        ],
        location: '办公室',
        timeOfDay: '日',
        visualStyle: '现代都市',
        cameraMovement: '跟踪镜头',
        specialEffects: ['阳光'],
        seedancePrompt: '主角在办公室',
        sceneAssets: [],
        compositeImageUrls: ['https://example.com/char.png']
      }

      const config = buildSeedanceConfig(segment)

      expect(config.duration).toBe(10)
      expect(config.aspectRatio).toBe('9:16')
      expect(config.resolution).toBe('720p')
      expect(config.prompt).toBeTruthy()
    })

    it('should handle duration limits', () => {
      const segment: StoryboardSegment = {
        episodeNum: 1,
        segmentNum: 1,
        description: '测试',
        duration: 20, // 超过15秒
        aspectRatio: '9:16',
        characters: [],
        location: '室内',
        timeOfDay: '日',
        visualStyle: '',
        cameraMovement: '',
        specialEffects: [],
        seedancePrompt: '',
        sceneAssets: [],
        compositeImageUrls: []
      }

      const config = buildSeedanceConfig(segment)
      expect(config.duration).toBe(15) // 应该被限制到15
    })
  })

  describe('validateSeedanceConfig', () => {
    it('should validate valid config', () => {
      const config = {
        prompt: '这是一个测试提示词用于验证配置有效性',
        imageUrls: ['https://example.com/1.png'],
        duration: 10,
        aspectRatio: '9:16' as const,
        resolution: '720p' as const,
        generateAudio: true
      }

      const result = validateSeedanceConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should detect short prompt', () => {
      const config = {
        prompt: '短',
        imageUrls: [],
        duration: 10,
        aspectRatio: '9:16' as const,
        resolution: '720p' as const,
        generateAudio: true
      }

      const result = validateSeedanceConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('提示词太短')
    })

    it('should detect too many images', () => {
      const config = {
        prompt: '测试提示词',
        imageUrls: Array(10).fill('https://example.com/img.png'),
        duration: 10,
        aspectRatio: '9:16' as const,
        resolution: '720p' as const,
        generateAudio: true
      }

      const result = validateSeedanceConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('参考图数量不能超过9张')
    })
  })

  describe('optimizePromptForSeedance', () => {
    it('should fix reference format', () => {
      const prompt = '@图1 主角在办公室'
      const result = optimizePromptForSeedance(prompt)
      expect(result).toContain('@图片1')
    })

    it('should add quality anchor', () => {
      const prompt = '主角在办公室'
      const result = optimizePromptForSeedance(prompt)
      expect(result).toContain('cinematic')
    })
  })

  describe('estimateSeedanceCost', () => {
    it('should estimate cost correctly', () => {
      const cost = estimateSeedanceCost(10)
      expect(cost).toBe(10) // ¥1/秒 * 10秒
    })
  })
})
