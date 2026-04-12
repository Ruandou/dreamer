/**
 * TTS 平台抽象接口
 */

import type { VoiceConfig } from '@dreamer/shared/types'

export interface TTSOptions {
  pitch?: number
  volume?: number
  speed?: number
}

export interface TTSProvider {
  /** 提供商名称 */
  name: string
  /** 合成语音，返回音频 URL */
  synthesize(text: string, voiceId: string, options?: TTSOptions): Promise<string>
  /** 从 VoiceConfig 获取平台对应的 voice_id */
  getVoiceId(config: VoiceConfig): string
}
