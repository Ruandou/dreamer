/**
 * 阿里云 Qwen3-TTS 提供商实现
 */

import type { VoiceConfig } from '@dreamer/shared/types'
import type { TTSOptions, TTSProvider } from './base.js'
import { getVoiceIdFromConfig } from './mapper.js'
import { uploadFile, generateFileKey } from '../storage.js'

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

    // 阿里云 TTS 返回音频数据
    const audioBuffer = Buffer.from(await response.arrayBuffer())

    // 上传音频到存储
    const filename = `tts_aliyun_${Date.now()}.mp3`
    const fileKey = generateFileKey('assets', filename)
    const audioUrl = await uploadFile('assets', fileKey, audioBuffer, 'audio/mpeg')

    return audioUrl
  }
}
