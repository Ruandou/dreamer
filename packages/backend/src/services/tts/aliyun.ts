/**
 * 阿里云 Qwen3-TTS 提供商实现
 */

import type { VoiceConfig } from '@dreamer/shared/types'
import type { TTSOptions, TTSProvider } from './base.js'
import { getVoiceIdFromConfig } from './mapper.js'

const ARK_API_KEY = process.env.ARK_API_KEY || ''
const ARK_API_URL = process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3'

export class AliyunTTSProvider implements TTSProvider {
  name = 'aliyun'

  getVoiceId(config: VoiceConfig): string {
    return getVoiceIdFromConfig(config, 'aliyun')
  }

  async synthesize(text: string, voiceId: string, options?: TTSOptions): Promise<string> {
    // 构建请求体
    const requestBody = {
      model: 'qwen-tts',
      input: {
        text,
        voice_id: voiceId
      },
      voice_settings: {
        speed: options?.speed ?? 1.0,
        pitch: options?.pitch ?? 0,
        volume: options?.volume ?? 50
      }
    }

    const response = await globalThis.fetch(`${ARK_API_URL}/audio/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Aliyun TTS API error: ${response.status} - ${error}`)
    }

    // 阿里云 TTS 返回音频数据，需要处理
    // 实际实现可能需要根据 API 响应格式调整
    const _audioData = await response.arrayBuffer()

    // 这里应该上传到存储并返回 URL
    // 暂时返回空字符串，实际使用时需要实现存储逻辑
    console.warn('Aliyun TTS audio storage not implemented, returning empty URL')
    return ''
  }
}
