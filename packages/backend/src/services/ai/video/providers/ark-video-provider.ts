/**
 * 火山方舟 Video Provider 实现（Seedance 2.0）
 */

import type {
  VideoProvider,
  VideoGenerationRequest,
  VideoTaskResponse,
  VideoStatusResponse
} from '../video-provider.js'
import type { ProviderConfig } from '../../core/provider-interface.js'
// calculateDurationCost available in cost-calculator when needed

export class ArkVideoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArkVideoError'
  }
}

export class ArkVideoProvider implements VideoProvider {
  readonly name = 'ark'
  readonly type = 'video' as const

  private config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  getConfig(): ProviderConfig {
    return { ...this.config }
  }

  async submitGeneration(request: VideoGenerationRequest): Promise<VideoTaskResponse> {
    const model = request.model || this.config.defaultModel || 'doubao-seedance-2-0-fast-260128'
    const body = this.buildArkRequest(request, model)

    const res = await fetch(`${this.config.baseURL}/contents/generations/tasks`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const error = await res.text()
      throw new ArkVideoError(`Seedance API 错误 ${res.status}: ${error}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    return {
      taskId: String(data.id),
      status: 'queued'
    }
  }

  async queryStatus(taskId: string): Promise<VideoStatusResponse> {
    const res = await fetch(`${this.config.baseURL}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!res.ok) {
      const error = await res.text()
      throw new ArkVideoError(`Seedance API 错误 ${res.status}: ${error}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const status = this.mapStatus(String(data.status))
    const content = data.content as Record<string, unknown> | undefined

    return {
      taskId: String(data.id),
      status,
      videoUrl: content?.video_url as string | undefined,
      thumbnailUrl: content?.thumbnail_url as string | undefined,
      error: (data.error as Record<string, unknown>)?.message as string | undefined
    }
  }

  // ==================== 工具方法 ====================

  private buildArkRequest(request: VideoGenerationRequest, model: string): Record<string, unknown> {
    const content: Array<Record<string, unknown>> = []

    let promptText = request.prompt
    if (request.aspectRatio) {
      promptText += ` --ratio ${request.aspectRatio}`
    }
    promptText += ` --fps 24 --dur ${request.duration || 5}`

    content.push({ type: 'text', text: promptText })

    // 参考图片
    if (request.imageUrls && request.imageUrls.length > 0) {
      request.imageUrls.forEach((url) => {
        content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' })
      })
    }

    const body: Record<string, unknown> = {
      model,
      content,
      duration: request.duration || 5,
      resolution: request.mode === 'pro' ? '1080p' : '720p',
      ratio: request.aspectRatio || '9:16',
      generate_audio: request.generateAudio ?? true,
      watermark: false
    }

    // 音频配置
    if (request.audioConfig) {
      body.audio_config = request.audioConfig
    }

    return body
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new ArkVideoError('未配置 API Key，无法调用 Seedance 接口')
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`
    }
  }

  private mapStatus(status: string): VideoStatusResponse['status'] {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'queued':
        return 'queued'
      case 'processing':
      case 'running':
      case 'in_progress':
        return 'processing'
      case 'completed':
      case 'succeeded':
      case 'success':
        return 'completed'
      case 'failed':
      case 'error':
        return 'failed'
      default:
        return 'processing'
    }
  }
}

/** 成本计算：Seedance 2.0-fast 约 ¥1/秒 */
export function calculateSeedanceCost(durationSeconds: number): number {
  const CNY_PER_SECOND = 1.0
  return durationSeconds * CNY_PER_SECOND
}

/** 批量将图片 URL 数组转换为 base64 */
export async function imageUrlsToBase64(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((url) => imageUrlToBase64(url)))
}

/** 将图片 URL 转换为 base64 */
export async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}
