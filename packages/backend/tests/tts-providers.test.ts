import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AliyunTTSProvider } from '../src/services/tts/aliyun.js'
import { VolcanoTTSProvider } from '../src/services/tts/volcano.js'
import { synthesizeSpeech } from '../src/services/tts/index.js'
import type { VoiceConfig } from '@dreamer/shared/types'

const baseVc: VoiceConfig = {
  gender: 'female',
  age: 'young',
  tone: 'mid',
  timbre: 'warm_solid',
  speed: 'medium'
}

describe('TTS providers', () => {
  describe('AliyunTTSProvider', () => {
    beforeEach(() => {
      process.env.ARK_API_KEY = 'k'
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('getVoiceId delegates to mapper', () => {
      const p = new AliyunTTSProvider()
      const id = p.getVoiceId(baseVc)
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('synthesize posts to Ark and returns empty url on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2]).buffer
        })
      )
      const p = new AliyunTTSProvider()
      const url = await p.synthesize('你好', p.getVoiceId(baseVc), { speed: 1.1 })
      expect(url).toBe('')
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/audio/tts'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws when API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'err'
        })
      )
      const p = new AliyunTTSProvider()
      await expect(p.synthesize('x', 'voice-id')).rejects.toThrow(/Aliyun TTS API error/)
    })
  })

  describe('VolcanoTTSProvider', () => {
    beforeEach(() => {
      process.env.VOLCANO_ACCESS_TOKEN = 'tok'
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('getVoiceId returns mapper id', () => {
      const p = new VolcanoTTSProvider()
      expect(p.getVoiceId(baseVc)).toBeTruthy()
    })

    it('synthesize calls openspeech on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(0)
        })
      )
      const p = new VolcanoTTSProvider()
      const url = await p.synthesize('hi', 'vid')
      expect(url).toBe('')
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://openspeech.bytedance.com/api/v1/tts',
        expect.any(Object)
      )
    })

    it('throws when API not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: async () => 'no'
        })
      )
      const p = new VolcanoTTSProvider()
      await expect(p.synthesize('a', 'b')).rejects.toThrow(/Volcano TTS API error/)
    })
  })

  describe('synthesizeSpeech (tts/index)', () => {
    beforeEach(() => {
      process.env.ARK_API_KEY = 'k'
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(0)
        })
      )
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('delegates to Aliyun provider by default', async () => {
      const url = await synthesizeSpeech('你好世界', {
        gender: 'female',
        age: 'young',
        tone: 'mid',
        timbre: 'warm_solid',
        speed: 'medium'
      })
      expect(url).toBe('')
    })
  })
})
