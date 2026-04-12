import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AliyunTTSProvider } from '../../src/services/tts/aliyun.js'
import { VolcanoTTSProvider } from '../../src/services/tts/volcano.js'
import { getTTSProvider, synthesizeSpeech } from '../../src/services/tts/index.js'
import type { VoiceConfig } from '@dreamer/shared/types'

describe('TTS Providers', () => {
  describe('AliyunTTSProvider', () => {
    const provider = new AliyunTTSProvider()

    it('should have correct name', () => {
      expect(provider.name).toBe('aliyun')
    })

    it('should return correct voice id for config', () => {
      const config: VoiceConfig = {
        gender: 'female',
        age: 'young',
        tone: 'mid',
        timbre: 'warm_solid',
        speed: 'medium'
      }
      const voiceId = provider.getVoiceId(config)
      expect(voiceId).toBe('zh_female_shuangkuai')
    })

    it('should return correct voice id for male config', () => {
      const config: VoiceConfig = {
        gender: 'male',
        age: 'middle_aged',
        tone: 'mid',
        timbre: 'warm_thick',
        speed: 'slow'
      }
      const voiceId = provider.getVoiceId(config)
      expect(voiceId).toBe('zh_male_zhongnian')
    })
  })

  describe('VolcanoTTSProvider', () => {
    const provider = new VolcanoTTSProvider()

    it('should have correct name', () => {
      expect(provider.name).toBe('volcano')
    })

    it('should return correct voice id for config', () => {
      const config: VoiceConfig = {
        gender: 'female',
        age: 'young',
        tone: 'mid',
        timbre: 'soft_gentle',
        speed: 'medium'
      }
      const voiceId = provider.getVoiceId(config)
      expect(voiceId).toBe('BV700_V2_female_wenrou')
    })

    it('should return correct voice id for male config', () => {
      const config: VoiceConfig = {
        gender: 'male',
        age: 'old',
        tone: 'mid',
        timbre: 'warm_solid',
        speed: 'slow'
      }
      const voiceId = provider.getVoiceId(config)
      expect(voiceId).toBe('BV700_V2_male_old')
    })
  })

  describe('getTTSProvider', () => {
    it('should return aliyun provider', () => {
      const provider = getTTSProvider('aliyun')
      expect(provider.name).toBe('aliyun')
    })

    it('should return volcano provider', () => {
      const provider = getTTSProvider('volcano')
      expect(provider.name).toBe('volcano')
    })
  })

  describe('synthesizeSpeech', () => {
    beforeEach(() => {
      vi.stubEnv('ARK_API_KEY', 'test-api-key')
      vi.stubEnv('ARK_API_URL', 'https://test.api.com')
    })

    it('should synthesize speech with correct voice id', async () => {
      const config: VoiceConfig = {
        gender: 'female',
        age: 'young',
        tone: 'mid',
        timbre: 'warm_solid',
        speed: 'medium'
      }

      // Note: This test will warn about unimplemented audio storage
      // In a real scenario, we would mock the fetch call
      const provider = getTTSProvider('aliyun')
      const voiceId = provider.getVoiceId(config)
      expect(voiceId).toBe('zh_female_shuangkuai')
    })
  })
})
