import { describe, it, expect } from 'vitest'
import { inferVoiceConfig } from '../src/services/storyboard/voice-config-inferrer.js'

describe('inferVoiceConfig', () => {
  const DEFAULT = {
    gender: 'female',
    age: 'young',
    tone: 'mid',
    timbre: 'warm_solid',
    speed: 'medium'
  }

  it('returns default when no emotion and no time', () => {
    expect(inferVoiceConfig('Alice')).toEqual(DEFAULT)
  })

  it('returns default for unknown emotion', () => {
    expect(inferVoiceConfig('Alice', 'surprised')).toEqual(DEFAULT)
  })

  it('handles excited emotion', () => {
    expect(inferVoiceConfig('Alice', 'excited')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high'
    })
  })

  it('handles happy emotion', () => {
    expect(inferVoiceConfig('Alice', 'happy')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high'
    })
  })

  it('handles joyful emotion', () => {
    expect(inferVoiceConfig('Alice', 'joyful')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high'
    })
  })

  it('handles sad emotion', () => {
    expect(inferVoiceConfig('Alice', 'sad')).toEqual({
      ...DEFAULT,
      speed: 'slow',
      tone: 'low'
    })
  })

  it('handles cry emotion', () => {
    expect(inferVoiceConfig('Alice', 'cry')).toEqual({
      ...DEFAULT,
      speed: 'slow',
      tone: 'low'
    })
  })

  it('handles angry emotion', () => {
    expect(inferVoiceConfig('Alice', 'angry')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high',
      timbre: 'warm_thick'
    })
  })

  it('handles furious emotion', () => {
    expect(inferVoiceConfig('Alice', 'furious')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high',
      timbre: 'warm_thick'
    })
  })

  it('handles confused emotion', () => {
    expect(inferVoiceConfig('Alice', 'confused')).toEqual({
      ...DEFAULT,
      speed: 'slow',
      tone: 'low_mid'
    })
  })

  it('handles puzzled emotion', () => {
    expect(inferVoiceConfig('Alice', 'puzzled')).toEqual({
      ...DEFAULT,
      speed: 'slow',
      tone: 'low_mid'
    })
  })

  it('handles fear emotion', () => {
    expect(inferVoiceConfig('Alice', 'fear')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high',
      timbre: 'soft_gentle'
    })
  })

  it('handles scared emotion', () => {
    expect(inferVoiceConfig('Alice', 'scared')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high',
      timbre: 'soft_gentle'
    })
  })

  it('handles uppercase emotion', () => {
    expect(inferVoiceConfig('Alice', 'HAPPY')).toEqual({
      ...DEFAULT,
      speed: 'fast',
      tone: 'high'
    })
  })

  it('returns night adjustment when sceneTimeOfDay is 夜', () => {
    expect(inferVoiceConfig('Alice', undefined, '夜')).toEqual({
      ...DEFAULT,
      timbre: 'warm_thick'
    })
  })

  it('returns dusk adjustment when sceneTimeOfDay is 昏', () => {
    expect(inferVoiceConfig('Alice', undefined, '昏')).toEqual({
      ...DEFAULT,
      timbre: 'warm_thick'
    })
  })

  it('emotion takes precedence over time-of-day', () => {
    expect(inferVoiceConfig('Alice', 'sad', '夜')).toEqual({
      ...DEFAULT,
      speed: 'slow',
      tone: 'low'
    })
  })
})
