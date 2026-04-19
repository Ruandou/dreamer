/**
 * 火山引擎语音合成提供商实现
 */

import type { VoiceConfig } from '@dreamer/shared/types'
import type { TTSOptions, TTSProvider } from './base.js'
import { getVoiceIdFromConfig } from './mapper.js'

const VOLCANO_APP_ID = process.env.VOLCANO_APP_ID || ''
const VOLCANO_ACCESS_TOKEN = process.env.VOLCANO_ACCESS_TOKEN || ''

export class VolcanoTTSProvider implements TTSProvider {
  name = 'volcano'

  getVoiceId(config: VoiceConfig): string {
    return getVoiceIdFromConfig(config, 'volcano')
  }

  async synthesize(text: string, voiceId: string, options?: TTSOptions): Promise<string> {
    // 火山引擎 TTS API 调用
    // 实际实现需要根据火山引擎 API 文档调整
    const requestBody = {
      appid: VOLCANO_APP_ID,
      text,
      voice_id: voiceId,
      speed: options?.speed ?? 1.0,
      pitch: options?.pitch ?? 0,
      volume: options?.volume ?? 50
    }

    const response = await globalThis.fetch('https://openspeech.bytedance.com/api/v1/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VOLCANO_ACCESS_TOKEN}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Volcano TTS API error: ${response.status} - ${error}`)
    }

    // 火山引擎返回音频数据
    // TODO: 实现音频存储逻辑，将 arrayBuffer 上传到 OSS/S3 并返回 URL
    await response.arrayBuffer() // 消费响应流

    // 暂时返回空字符串，实际使用时需要实现存储逻辑
    console.warn('Volcano TTS audio storage not implemented, returning empty URL')
    return ''
  }
}
