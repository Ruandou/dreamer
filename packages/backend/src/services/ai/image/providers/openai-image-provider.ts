/**
 * OpenAI Image Provider 实现
 * DALL-E 3 / DALL-E 2
 */

import type {
  ImageProvider,
  ImageProviderConfig,
  TextToImageOptions,
  ImageEditOptions,
  ImageGenerationResult
} from '../image-provider.js'
import { calculatePerCallCost } from '../../core/cost-calculator.js'

export class OpenAIImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenAIImageError'
  }
}

export class OpenAIImageProvider implements ImageProvider {
  readonly name = 'openai'
  readonly type = 'image' as const

  private config: ImageProviderConfig

  constructor(config: ImageProviderConfig) {
    this.config = config
  }

  getConfig(): ImageProviderConfig {
    return { ...this.config }
  }

  async generateTextToImage(
    prompt: string,
    options: TextToImageOptions = {}
  ): Promise<ImageGenerationResult> {
    const model = options.model || this.config.defaultModel || 'dall-e-3'

    const res = await fetch(`${this.config.baseURL}/images/generations`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        model,
        prompt,
        n: options.n ?? 1,
        size: options.size || '1024x1024',
        response_format: 'url'
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new OpenAIImageError(`OpenAI 图片 API 错误 ${res.status}: ${text}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const url = this.firstImageUrl(data)

    // DALL-E 3: 标准 $0.04/张 ≈ ¥0.29, HD $0.08/张 ≈ ¥0.58
    const imageCost = model === 'dall-e-3' ? 0.29 : 0.15

    return {
      url,
      imageCost,
      provider: this.name,
      model,
      cost: calculatePerCallCost(imageCost),
      rawResponse: data
    }
  }

  async generateImageEdit(
    referenceImageUrl: string,
    prompt: string,
    options: ImageEditOptions = {}
  ): Promise<ImageGenerationResult> {
    const model = options.model || this.config.defaultModel || 'dall-e-2'

    // OpenAI 图片编辑需要 multipart/form-data
    const formData = new FormData()
    formData.append('prompt', prompt)
    formData.append('model', model)
    formData.append('n', '1')
    formData.append('size', options.size || '1024x1024')

    // 下载参考图并附加
    const imageRes = await fetch(referenceImageUrl)
    if (!imageRes.ok) {
      throw new OpenAIImageError(`下载参考图失败: ${imageRes.status}`)
    }
    const imageBlob = await imageRes.blob()
    formData.append('image', imageBlob, 'image.png')

    const res = await fetch(`${this.config.baseURL}/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: formData
    })

    if (!res.ok) {
      const text = await res.text()
      throw new OpenAIImageError(`OpenAI 图片编辑 API 错误 ${res.status}: ${text}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const url = this.firstImageUrl(data)
    const imageCost = 0.15

    return {
      url,
      imageCost,
      provider: this.name,
      model,
      cost: calculatePerCallCost(imageCost),
      rawResponse: data
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new OpenAIImageError('未配置 API Key，无法调用 OpenAI 图片接口')
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`
    }
  }

  private firstImageUrl(result: Record<string, unknown>): string {
    const data = result.data
    if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') {
      throw new OpenAIImageError('OpenAI 图片 API 未返回图片 URL')
    }
    const url = (data[0] as { url?: string }).url
    if (!url) {
      throw new OpenAIImageError('OpenAI 图片 API 未返回图片 URL')
    }
    return url
  }
}
