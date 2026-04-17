import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getVoiceIdFromConfig, type TTSPlatform } from '../../src/services/tts/mapper.js'
import type { VoiceConfig } from '@dreamer/shared/types'

// Suppress console.error/warn for cleaner test output
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

describe('TTS Mapper', () => {
  describe('getVoiceIdFromConfig', () => {
    const testCases: Array<{
      name: string
      config: VoiceConfig
      platform: TTSPlatform
      expected: string
    }> = [
      {
        name: 'should return correct voice for young male warm_solid on aliyun',
        config: { gender: 'male', age: 'young', tone: 'mid', timbre: 'warm_solid', speed: 'medium' },
        platform: 'aliyun',
        expected: 'zh_male_qingrun'
      },
      {
        name: 'should return correct voice for young male clear_bright on aliyun',
        config: { gender: 'male', age: 'young', tone: 'mid', timbre: 'clear_bright', speed: 'medium' },
        platform: 'aliyun',
        expected: 'zh_male_qingse'
      },
      {
        name: 'should return default voice for young male with unknown timbre on aliyun',
        config: { gender: 'male', age: 'young', tone: 'mid', timbre: 'unknown' as any, speed: 'medium' },
        platform: 'aliyun',
        expected: 'zh_male_shaonian'
      },
      {
        name: 'should return correct voice for young female warm_solid on aliyun',
        config: { gender: 'female', age: 'young', tone: 'mid', timbre: 'warm_solid', speed: 'medium' },
        platform: 'aliyun',
        expected: 'zh_female_shuangkuai'
      },
      {
        name: 'should return correct voice for young female soft_gentle on aliyun',
        config: { gender: 'female', age: 'young', tone: 'mid', timbre: 'soft_gentle', speed: 'medium' },
        platform: 'aliyun',
        expected: 'zh_female_wenrou'
      },
      {
        name: 'should return default voice for middle_aged male on aliyun',
        config: { gender: 'male', age: 'middle_aged', tone: 'mid', timbre: 'warm_solid', speed: 'medium' },
        platform: 'aliyun',
        expected: 'zh_male_wenrun'
      },
      {
        name: 'should return correct voice for old female on aliyun',
        config: { gender: 'female', age: 'old', tone: 'mid', timbre: 'warm_solid', speed: 'medium' },
        platform: 'aliyun',
        expected: 'zh_female_laonian'
      },
      {
        name: 'should return correct voice for young male on volcano',
        config: { gender: 'male', age: 'young', tone: 'mid', timbre: 'warm_solid', speed: 'medium' },
        platform: 'volcano',
        expected: 'BV700_V2_male_qingrun'
      },
      {
        name: 'should return correct voice for young female on volcano',
        config: { gender: 'female', age: 'young', tone: 'mid', timbre: 'soft_gentle', speed: 'medium' },
        platform: 'volcano',
        expected: 'BV700_V2_female_wenrou'
      }
    ]

    testCases.forEach(({ name, config, platform, expected }) => {
      it(name, () => {
        const result = getVoiceIdFromConfig(config, platform)
        expect(result).toBe(expected)
      })
    })

    it('should fallback to default voice when config is invalid', () => {
      const invalidConfig = { gender: 'unknown' as any, age: 'unknown' as any, tone: 'mid' as any, timbre: 'unknown' as any, speed: 'medium' as any }
      const result = getVoiceIdFromConfig(invalidConfig, 'aliyun')
      expect(result).toBe('zh_female_qingxin') // default
    })

    it('should handle config with optional pitch and volume', () => {
      const configWithExtras: VoiceConfig = {
        gender: 'male',
        age: 'young',
        tone: 'mid',
        timbre: 'warm_solid',
        speed: 'medium',
        pitch: 1.0,
        volume: 80
      }
      const result = getVoiceIdFromConfig(configWithExtras, 'aliyun')
      expect(result).toBe('zh_male_qingrun')
    })
  })
})
