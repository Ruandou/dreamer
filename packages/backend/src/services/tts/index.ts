/**
 * TTS 模块统一导出
 */

import type { TTSProvider } from './base.js'
import type { VoiceConfig } from '@dreamer/shared/types'
import { AliyunTTSProvider } from './aliyun.js'
import { VolcanoTTSProvider } from './volcano.js'
import { getVoiceIdFromConfig, type TTSPlatform } from './mapper.js'

export type { TTSOptions, TTSProvider } from './base.js'
export { getVoiceIdFromConfig, type TTSPlatform } from './mapper.js'

// TTS Provider 实例缓存
const providers: Record<TTSPlatform, TTSProvider> = {
  aliyun: new AliyunTTSProvider(),
  volcano: new VolcanoTTSProvider()
}

/**
 * 获取 TTS Provider 实例
 */
export function getTTSProvider(platform: TTSPlatform): TTSProvider {
  return providers[platform]
}

/**
 * 合成语音（便捷函数）
 */
export async function synthesizeSpeech(
  text: string,
  voiceConfig: VoiceConfig,
  platform: TTSPlatform = 'aliyun',
  options?: { pitch?: number; volume?: number; speed?: number }
): Promise<string> {
  const provider = getTTSProvider(platform)
  const voiceId = provider.getVoiceId(voiceConfig)
  return provider.synthesize(text, voiceId, options)
}
