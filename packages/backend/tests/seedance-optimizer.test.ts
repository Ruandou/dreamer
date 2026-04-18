import { describe, it, expect } from 'vitest'
import {
  buildSeedanceConfig,
  buildSeedanceConfigs,
  validateSeedanceConfig,
  optimizePromptForSeedance,
  estimateSeedanceCost,
  selectBestCharacterImage,
  generateFirstFramePrompt,
  evaluatePromptQuality
} from '../src/services/ai/seedance-optimizer.js'
import type { StoryboardSegment, CharacterImage, SceneAsset } from '@dreamer/shared/types'

function baseSegment(over: Partial<StoryboardSegment> = {}): StoryboardSegment {
  return {
    episodeNum: 1,
    segmentNum: 1,
    description: '一段用来凑够字数的分镜描述正文内容',
    duration: 10,
    aspectRatio: '9:16',
    characters: [
      {
        name: '主角',
        actions: [
          {
            characterName: '主角',
            actionType: 'movement',
            description: '推门进入'
          }
        ],
        referenceImageUrl: 'https://example.com/c1.png'
      },
      {
        name: '配角',
        actions: [],
        referenceImageUrl: 'https://example.com/c2.png'
      }
    ],
    location: '办公室',
    timeOfDay: '日',
    visualStyle: ['现代都市', '电影质感'],
    cameraMovement: '跟踪镜头',
    specialEffects: ['阳光'],
    seedancePrompt: '主角在办公室',
    sceneAssets: [],
    compositeImageUrls: [],
    ...over
  }
}

describe('Seedance Optimizer Service', () => {
  describe('buildSeedanceConfig', () => {
    it('should build config from segment', () => {
      const segment = baseSegment()

      const config = buildSeedanceConfig(segment)

      expect(config.duration).toBe(10)
      expect(config.aspectRatio).toBe('9:16')
      expect(config.resolution).toBe('720p')
      expect(config.prompt).toBeTruthy()
      expect(config.imageUrls.length).toBeGreaterThan(0)
    })

    it('should handle duration limits', () => {
      const segment = baseSegment({
        duration: 20,
        characters: [],
        visualStyle: [],
        specialEffects: [],
        description: '测'
      })

      const config = buildSeedanceConfig(segment)
      expect(config.duration).toBe(15)
    })

    it('clamps duration below 4 seconds', () => {
      const segment = baseSegment({ duration: 1 })
      expect(buildSeedanceConfig(segment).duration).toBe(4)
    })

    it('selects sceneAssets by type and respects maxReferenceImages', () => {
      const assets: SceneAsset[] = [
        { type: 'background', url: 'https://ex/bg.png', description: 'bg' },
        { type: 'atmosphere', url: 'https://ex/at.png', description: 'at' },
        { type: 'style', url: 'https://ex/st.png', description: 'st' }
      ]
      const segment = baseSegment({
        characters: [],
        sceneAssets: assets
      })
      const config = buildSeedanceConfig(segment, { maxReferenceImages: 3 })
      expect(config.imageUrls.length).toBeLessThanOrEqual(3)
    })

    it('enhancePrompt adds night and dusk atmosphere words', () => {
      const night = buildSeedanceConfig(baseSegment({ timeOfDay: '夜' }))
      expect(night.prompt).toMatch(/月光|灯光/)

      const dusk = buildSeedanceConfig(baseSegment({ timeOfDay: '昏' }))
      expect(dusk.prompt).toMatch(/黄昏/)
    })
  })

  describe('buildSeedanceConfigs', () => {
    it('maps every segment', () => {
      const a = baseSegment({ segmentNum: 1 })
      const b = baseSegment({ segmentNum: 2, description: '第二镜描述文字足够长一些' })
      const configs = buildSeedanceConfigs([a, b], { generateAudio: false })
      expect(configs).toHaveLength(2)
      expect(configs[1].generateAudio).toBe(false)
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

    it('should detect prompt that is too long', () => {
      const config = {
        prompt: 'x'.repeat(1001),
        imageUrls: [],
        duration: 10,
        aspectRatio: '9:16' as const,
        resolution: '720p' as const,
        generateAudio: true
      }
      const result = validateSeedanceConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('太长'))).toBe(true)
    })

    it('should detect invalid duration', () => {
      const config = {
        prompt: '长度足够的基本提示词内容用于校验',
        imageUrls: [],
        duration: 2,
        aspectRatio: '9:16' as const,
        resolution: '720p' as const,
        generateAudio: true
      }
      expect(validateSeedanceConfig(config).errors.some((e) => e.includes('时长'))).toBe(true)
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

    it('should not duplicate anchor when prompt already has 8K', () => {
      const prompt = '史诗场景，8K画质'
      const out = optimizePromptForSeedance(prompt)
      const n = (out.match(/cinematic/gi) || []).length
      expect(n).toBeLessThanOrEqual(1)
    })

    it('normalizes @imageN form', () => {
      expect(optimizePromptForSeedance('see @image2 end')).toContain('@图片2')
    })
  })

  describe('estimateSeedanceCost', () => {
    it('should estimate cost correctly', () => {
      const cost = estimateSeedanceCost(10)
      expect(cost).toBe(10) // ¥1/秒 * 10秒
    })
  })

  describe('selectBestCharacterImage', () => {
    const d = new Date()
    const img = (o: Partial<CharacterImage>): CharacterImage => ({
      id: 'i1',
      characterId: 'c1',
      name: '唐僧师徒',
      type: 'base',
      order: 1,
      createdAt: d,
      updatedAt: d,
      ...o
    })

    it('returns base avatar when name matches', () => {
      const url = selectBestCharacterImage('唐僧', [
        img({ name: '唐僧表情', avatarUrl: 'https://a.png', type: 'expression' }),
        img({ name: '唐僧', avatarUrl: 'https://base.png', type: 'base' })
      ])
      expect(url).toBe('https://base.png')
    })

    it('returns undefined when no match', () => {
      expect(selectBestCharacterImage('X', [img({ name: 'Y' })])).toBeUndefined()
    })
  })

  describe('generateFirstFramePrompt', () => {
    it('appends reference hint when url provided', () => {
      const s = baseSegment()
      const p = generateFirstFramePrompt(s, 'https://ref.png')
      expect(p).toContain('参考角色形象')
    })
  })

  describe('evaluatePromptQuality', () => {
    it('returns score and issues when prompt misses location', () => {
      const s = baseSegment({ location: '天台' })
      const r = evaluatePromptQuality('只有人物没有地点', s)
      expect(r.issues.length).toBeGreaterThan(0)
      expect(r.score).toBeLessThan(100)
    })
  })
})
