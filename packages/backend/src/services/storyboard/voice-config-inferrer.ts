/**
 * Voice configuration inference — pure function mapping emotion/time to VoiceConfig
 */

import type { VoiceConfig } from '@dreamer/shared/types'

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  gender: 'female',
  age: 'young',
  tone: 'mid',
  timbre: 'warm_solid',
  speed: 'medium'
}

/**
 * Infer voice configuration from character name, emotion, and scene time.
 * Uses emotion-based rules with time-of-day adjustments.
 */
export function inferVoiceConfig(
  _characterName: string,
  emotion?: string,
  sceneTimeOfDay?: string
): VoiceConfig {
  // Emotion-based adjustments
  if (emotion) {
    switch (emotion.toLowerCase()) {
      case 'excited':
      case 'happy':
      case 'joyful':
        return { ...DEFAULT_VOICE_CONFIG, speed: 'fast', tone: 'high' }
      case 'sad':
      case 'cry':
        return { ...DEFAULT_VOICE_CONFIG, speed: 'slow', tone: 'low' }
      case 'angry':
      case 'furious':
        return { ...DEFAULT_VOICE_CONFIG, speed: 'fast', tone: 'high', timbre: 'warm_thick' }
      case 'confused':
      case 'puzzled':
        return { ...DEFAULT_VOICE_CONFIG, speed: 'slow', tone: 'low_mid' }
      case 'fear':
      case 'scared':
        return { ...DEFAULT_VOICE_CONFIG, speed: 'fast', tone: 'high', timbre: 'soft_gentle' }
      default:
        return DEFAULT_VOICE_CONFIG
    }
  }

  // Time-of-day adjustments
  if (sceneTimeOfDay === '夜' || sceneTimeOfDay === '昏') {
    return { ...DEFAULT_VOICE_CONFIG, timbre: 'warm_thick' }
  }

  return DEFAULT_VOICE_CONFIG
}
