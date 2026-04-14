import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import {
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale,
  normalizeArkImageSize,
  ARK_IMAGE_MIN_TOTAL_PIXELS,
  extractImageCostFromArkResponse,
  arkImageSizeFromProjectAspectRatio,
  imageJobPrompt,
  imageJobModel,
  DEFAULT_T2I_MODEL,
  DEFAULT_EDIT_MODEL,
  generateTextToImage
} from '../src/services/ai/image-generation.js'
import type { ImageGenerationJobData } from '@dreamer/shared/types'

describe('image-generation', () => {
  describe('arkImageSizeFromProjectAspectRatio', () => {
    it('maps 9:16 to portrait size meeting Ark min pixels', () => {
      expect(arkImageSizeFromProjectAspectRatio('9:16')).toBe('1440x2560')
    })
    it('maps 16:9 and 1:1', () => {
      expect(arkImageSizeFromProjectAspectRatio('16:9')).toBe('2560x1440')
      expect(arkImageSizeFromProjectAspectRatio('1:1')).toBe('1920x1920')
    })
    it('falls back for garbage', () => {
      expect(arkImageSizeFromProjectAspectRatio('bad')).toBe('1440x2560')
    })
    it('maps 4:3, 3:4 and 21:9', () => {
      expect(arkImageSizeFromProjectAspectRatio('4:3')).toBe('2220x1665')
      expect(arkImageSizeFromProjectAspectRatio('3:4')).toBe('1665x2220')
      expect(arkImageSizeFromProjectAspectRatio('21:9')).toBe('4410x1890')
    })
  })

  describe('normalizeArkImageSize', () => {
    it('bumps 1024x1024 to 1920x1920 (below Ark min total pixels)', () => {
      expect(normalizeArkImageSize('1024x1024')).toBe('1920x1920')
      expect(1024 * 1024).toBeLessThan(ARK_IMAGE_MIN_TOTAL_PIXELS)
    })
    it('keeps adaptive and empty as default', () => {
      expect(normalizeArkImageSize('adaptive')).toBe('1920x1920')
      expect(normalizeArkImageSize(undefined)).toBe('1920x1920')
      expect(normalizeArkImageSize('')).toBe('1920x1920')
    })
    it('keeps sizes meeting minimum', () => {
      expect(normalizeArkImageSize('1920x1920')).toBe('1920x1920')
      expect(normalizeArkImageSize('2560x1440')).toBe('2560x1440')
      expect(2560 * 1440).toBe(ARK_IMAGE_MIN_TOTAL_PIXELS)
    })
    it('returns default for garbage', () => {
      expect(normalizeArkImageSize('large')).toBe('1920x1920')
    })
    it('accepts WxH with spaces around x', () => {
      expect(normalizeArkImageSize('1920 x 1920')).toBe('1920x1920')
    })
  })

  describe('extractImageCostFromArkResponse', () => {
    const prev = process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
    afterEach(() => {
      if (prev === undefined) delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      else process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS = prev
    })

    it('returns null when no usage or tokens', () => {
      expect(extractImageCostFromArkResponse({ data: [] })).toBeNull()
      expect(extractImageCostFromArkResponse({ usage: {} })).toBeNull()
    })
    it('estimates from usage.total_tokens with default ¥/M', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(extractImageCostFromArkResponse({ usage: { total_tokens: 1_000_000 } })).toBe(4)
      expect(extractImageCostFromArkResponse({ usage: { total_tokens: 500_000 } })).toBe(2)
    })
    it('respects ARK_IMAGE_YUAN_PER_MILLION_TOKENS', () => {
      process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS = '10'
      expect(extractImageCostFromArkResponse({ usage: { total_tokens: 1_000_000 } })).toBe(10)
    })
    it('falls back to billing_tokens on usage or root', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(extractImageCostFromArkResponse({ usage: { billing_tokens: 2_000_000 } })).toBe(8)
      expect(extractImageCostFromArkResponse({ billing_tokens: 1_000_000 })).toBe(4)
    })
    it('sums input_tokens + output_tokens when total missing', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(
        extractImageCostFromArkResponse({
          usage: { input_tokens: 300_000, output_tokens: 700_000 }
        })
      ).toBe(4)
    })
    it('uses image_tokens when present without total_tokens', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(
        extractImageCostFromArkResponse({
          usage: { image_tokens: 500_000 }
        })
      ).toBe(2)
    })
    it('sums prompt_tokens + completion_tokens when total missing', () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      expect(
        extractImageCostFromArkResponse({
          usage: { prompt_tokens: 400_000, completion_tokens: 600_000 }
        })
      ).toBe(4)
    })
  })

  describe('imageJobPrompt / imageJobModel', () => {
    it('returns prompt for t2i kinds', () => {
      const d = {
        kind: 'location_establishing',
        userId: 'u',
        projectId: 'p',
        locationId: 'l',
        prompt: 'sunset'
      } as ImageGenerationJobData
      expect(imageJobPrompt(d)).toBe('sunset')
      expect(imageJobModel(d)).toBe(DEFAULT_T2I_MODEL)
    })
    it('returns editPrompt and edit model for derived kinds', () => {
      const d = {
        kind: 'character_derived_regenerate',
        userId: 'u',
        projectId: 'p',
        characterImageId: 'i',
        referenceImageUrl: 'http://x',
        editPrompt: 'red hat'
      } as ImageGenerationJobData
      expect(imageJobPrompt(d)).toBe('red hat')
      expect(imageJobModel(d)).toBe(DEFAULT_EDIT_MODEL)
    })
    it('character_base_create uses prompt and t2i model', () => {
      const d: ImageGenerationJobData = {
        kind: 'character_base_create',
        userId: 'u',
        projectId: 'p',
        characterId: 'c',
        name: '定妆',
        prompt: 'face'
      }
      expect(imageJobPrompt(d)).toBe('face')
      expect(imageJobModel(d)).toBe(DEFAULT_T2I_MODEL)
    })
  })

  describe('imageEditModelUsesGuidanceScale', () => {
    it('should be true for SeedEdit model ids', () => {
      expect(imageEditModelUsesGuidanceScale('doubao-seededit-3-0-i2i-250628')).toBe(true)
    })
    it('should be false for Seedream model ids', () => {
      expect(imageEditModelUsesGuidanceScale('doubao-seedream-5-0-lite-260128')).toBe(false)
    })
  })

  describe('strengthToGuidanceScale', () => {
    it('should map strength to guidance_scale in 4–9 range', () => {
      expect(strengthToGuidanceScale(0)).toBe(4)
      expect(strengthToGuidanceScale(1)).toBe(9)
      expect(strengthToGuidanceScale(0.35)).toBe(6)
    })
    it('should clamp out-of-range values', () => {
      expect(strengthToGuidanceScale(-1)).toBe(4)
      expect(strengthToGuidanceScale(2)).toBe(9)
    })
  })

  describe('generateTextToImage', () => {
    let prevArkKey: string | undefined

    beforeEach(() => {
      prevArkKey = process.env.ARK_API_KEY
      process.env.ARK_API_KEY = 'test-ark-key'
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      if (prevArkKey === undefined) delete process.env.ARK_API_KEY
      else process.env.ARK_API_KEY = prevArkKey
    })

    it('returns url and cost from Ark images/generations JSON', async () => {
      delete process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () =>
            JSON.stringify({
              data: [{ url: 'https://ark.example/out.png' }],
              usage: { total_tokens: 250_000 }
            })
        })
      )
      const out = await generateTextToImage('a red car')
      expect(out.url).toBe('https://ark.example/out.png')
      expect(out.imageCost).toBe(1)
    })

    it('throws when API returns non-OK', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: async () => 'unauthorized'
        })
      )
      await expect(generateTextToImage('x')).rejects.toThrow(/方舟图片 API 错误 401/)
    })
  })
})
