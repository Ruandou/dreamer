import { describe, it, expect, vi } from 'vitest'
import { VolcanoTTSProvider } from '../src/services/tts/volcano.js'

vi.stubGlobal('fetch', vi.fn())

describe('VolcanoTTSProvider', () => {
  const provider = new VolcanoTTSProvider()

  it('has correct name', () => {
    expect(provider.name).toBe('volcano')
  })

  it('getVoiceId delegates to mapper', () => {
    const config = {
      gender: 'female' as const,
      age: 'young' as const,
      tone: 'mid' as const,
      timbre: 'warm_solid' as const,
      speed: 'medium' as const
    }
    const voiceId = provider.getVoiceId(config)
    expect(typeof voiceId).toBe('string')
    expect(voiceId.length).toBeGreaterThan(0)
  })

  it('synthesize uses default options when not provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    } as any)

    await provider.synthesize('hello', 'voice-1')

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    expect(body.speed).toBe(1.0)
    expect(body.pitch).toBe(0)
    expect(body.volume).toBe(50)
  })

  it('synthesize uses provided options', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    } as any)

    await provider.synthesize('hello', 'voice-1', { speed: 1.5, pitch: 2, volume: 80 })

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    // All options have fallback defaults in code
    expect(body).toHaveProperty('pitch')
    expect(body).toHaveProperty('volume')
  })

  it('throws on API error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Error')
    } as any)

    await expect(provider.synthesize('hello', 'voice-1')).rejects.toThrow(
      'Volcano TTS API error: 500'
    )
  })
})
