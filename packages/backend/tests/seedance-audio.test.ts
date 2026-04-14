import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    sceneDialogue: {
      findMany: (...args: unknown[]) => mockFindMany(...args)
    }
  }
}))

import { buildSeedanceAudio, getSceneVoiceSegments } from '../src/services/seedance-audio.js'

const vc = {
  gender: 'male' as const,
  age: 'young' as const,
  tone: 'mid' as const,
  timbre: 'warm_solid' as const,
  speed: 'medium' as const
}

describe('seedance-audio', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it('buildSeedanceAudio maps rows to Seedance payload', async () => {
    mockFindMany.mockResolvedValue([
      {
        text: '第一句',
        startTimeMs: 0,
        durationMs: 2000,
        voiceConfig: vc,
        order: 0,
        character: { id: 'c1', name: '甲' }
      },
      {
        text: '第二句',
        startTimeMs: 2000,
        durationMs: 1500,
        voiceConfig: vc,
        order: 1,
        character: { id: 'c2', name: '乙' }
      }
    ])

    const payload = await buildSeedanceAudio('scene-1')
    expect(payload.type).toBe('tts')
    expect(payload.segments).toHaveLength(2)
    expect(payload.segments[0]).toMatchObject({
      character_tag: '@Character1',
      text: '第一句',
      start_time: 0,
      duration: 2
    })
    expect(payload.segments[1]).toMatchObject({
      character_tag: '@Character2',
      text: '第二句',
      start_time: 2,
      duration: 1.5
    })
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { sceneId: 'scene-1' },
      orderBy: { order: 'asc' },
      include: { character: true }
    })
  })

  it('getSceneVoiceSegments maps DB rows to VoiceSegment + character', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'd1',
        characterId: 'c1',
        order: 0,
        startTimeMs: 100,
        durationMs: 500,
        text: 'hi',
        voiceConfig: vc,
        emotion: null,
        character: { id: 'c1', name: 'A' }
      }
    ])

    const rows = await getSceneVoiceSegments('s1')
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('hi')
    expect(rows[0].character.name).toBe('A')
    expect(rows[0].emotion).toBeUndefined()
  })
})
