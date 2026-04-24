/**
 * 火山方舟 Image Provider 实现
 * OpenAI 兼容接口（images/generations）
 */

import type {
  ImageProvider,
  ImageProviderConfig,
  TextToImageOptions,
  ImageEditOptions,
  ImageGenerationResult
} from '../image-provider.js'
import { calculateTokenQuantityCost } from '../../core/cost-calculator.js'
import { uploadFile, generateFileKey } from '../../../storage.js'

export class ArkImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArkImageError'
  }
}

/** 方舟 images/generations 对 `WxH` 总像素下限 */
export const ARK_IMAGE_MIN_TOTAL_PIXELS = 3686400
const DEFAULT_ARK_IMAGE_SIZE = '1920x1920'

export class ArkImageProvider implements ImageProvider {
  readonly name = 'ark'
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
    const model = options.model || this.config.defaultModel || 'doubao-seedream-5-0-lite-260128'
    const body: Record<string, unknown> = {
      model,
      prompt,
      size: normalizeArkImageSize(options.size),
      n: options.n ?? 1,
      response_format: 'url',
      watermark: options.watermark ?? false
    }

    const json = await this.postImagesGenerations(body)
    const url = this.firstImageUrl(json)
    const imageCost = this.extractImageCost(json)

    return {
      url,
      imageCost,
      provider: this.name,
      model,
      cost: imageCost !== null ? calculateTokenQuantityCost(imageCost * 250000, 4) : null,
      rawResponse: json
    }
  }

  async generateImageEdit(
    referenceImageUrl: string,
    prompt: string,
    options: ImageEditOptions = {}
  ): Promise<ImageGenerationResult> {
    const model = options.model || this.config.defaultModel || 'doubao-seedream-5-0-lite-260128'
    const imagePayload =
      process.env.ARK_IMAGE_EDIT_USE_BASE64 === '0'
        ? referenceImageUrl
        : await this.remoteImageUrlToDataUrl(referenceImageUrl)

    const body: Record<string, unknown> = {
      model,
      prompt,
      image: imagePayload,
      response_format: 'url',
      size: normalizeArkImageSize(options.size || 'adaptive'),
      watermark: options.watermark ?? false
    }
    if (this.imageEditModelUsesGuidanceScale(model)) {
      body.guidance_scale = this.strengthToGuidanceScale(options.strength ?? 0.35)
    }

    const json = await this.postImagesGenerations(body)
    const url = this.firstImageUrl(json)
    const imageCost = this.extractImageCost(json)

    return {
      url,
      imageCost,
      provider: this.name,
      model,
      cost: imageCost !== null ? calculateTokenQuantityCost(imageCost * 250000, 4) : null,
      rawResponse: json
    }
  }

  // ==================== 工具方法 ====================

  private async postImagesGenerations(
    body: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.config.baseURL}/images/generations`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })
    const text = await res.text()
    if (!res.ok) {
      throw new ArkImageError(`方舟图片 API 错误 ${res.status}: ${text}`)
    }
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new ArkImageError(`方舟图片 API 返回非 JSON: ${text.slice(0, 200)}`)
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new ArkImageError('未配置 API Key，无法调用方舟图片接口')
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`
    }
  }

  private firstImageUrl(result: Record<string, unknown>): string {
    const data = result.data
    if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') {
      throw new ArkImageError('方舟图片 API 未返回图片 URL')
    }
    const url = (data[0] as { url?: string }).url
    if (!url) {
      throw new ArkImageError('方舟图片 API 未返回图片 URL')
    }
    return url
  }

  private extractImageCost(parsed: Record<string, unknown>): number | null {
    const usage = parsed.usage
    if (!usage || typeof usage !== 'object') {
      const rootTok = this.readPositiveNumber(parsed.billing_tokens)
      if (!rootTok) return null
      return this.tokensToEstimatedYuan(rootTok)
    }
    const u = usage as Record<string, unknown>
    let tokens =
      this.readPositiveNumber(u.total_tokens) ||
      this.readPositiveNumber(u.billing_tokens) ||
      this.readPositiveNumber(u.image_tokens)
    if (!tokens) {
      const io = this.readPositiveNumber(u.input_tokens) + this.readPositiveNumber(u.output_tokens)
      if (io > 0) tokens = io
    }
    if (!tokens) {
      const pq =
        this.readPositiveNumber(u.prompt_tokens) + this.readPositiveNumber(u.completion_tokens)
      if (pq > 0) tokens = pq
    }
    if (!tokens) return null
    return this.tokensToEstimatedYuan(tokens)
  }

  private readPositiveNumber(v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) return n
    }
    return 0
  }

  private tokensToEstimatedYuan(tokens: number): number {
    const raw = process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
    const rate = raw != null && raw !== '' ? Number(raw) : 4
    const yuanPerM = Number.isFinite(rate) && rate >= 0 ? rate : 4
    const yuan = (tokens / 1_000_000) * yuanPerM
    return Math.round(yuan * 1_000_000) / 1_000_000
  }

  private async remoteImageUrlToDataUrl(imageUrl: string): Promise<string> {
    const res = await fetch(imageUrl)
    if (!res.ok) {
      throw new ArkImageError(`下载参考图失败: ${res.status}`)
    }
    const buf = await res.arrayBuffer()
    const ct = res.headers.get('content-type') || 'image/png'
    const b64 = Buffer.from(buf).toString('base64')
    return `data:${ct};base64,${b64}`
  }

  private imageEditModelUsesGuidanceScale(model: string): boolean {
    return model.toLowerCase().includes('seededit')
  }

  private strengthToGuidanceScale(strength: number): number {
    const s = Math.min(1, Math.max(0, strength))
    return Math.round(4 + s * 5)
  }
}

// ==================== 静态工具函数（兼容旧代码） ====================

export function normalizeArkImageSize(size: string | undefined): string {
  const raw = (size || '').trim().toLowerCase()
  if (!raw || raw === 'adaptive') {
    return DEFAULT_ARK_IMAGE_SIZE
  }
  const m = raw.match(/^(\d+)\s*x\s*(\d+)$/i)
  if (!m) return DEFAULT_ARK_IMAGE_SIZE
  const w = parseInt(m[1], 10)
  const h = parseInt(m[2], 10)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    return DEFAULT_ARK_IMAGE_SIZE
  }
  if (w * h >= ARK_IMAGE_MIN_TOTAL_PIXELS) {
    return `${w}x${h}`
  }
  return DEFAULT_ARK_IMAGE_SIZE
}

export function strengthToGuidanceScale(strength: number): number {
  const s = Math.min(1, Math.max(0, strength))
  return Math.round(4 + s * 5)
}

export function imageEditModelUsesGuidanceScale(model: string): boolean {
  return model.toLowerCase().includes('seededit')
}

/** 下载远程图并转存到资产桶 */
export async function persistRemoteImageToAssets(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl)
  if (!res.ok) {
    throw new ArkImageError(`拉取生成图失败: ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = res.headers.get('content-type') || 'image/png'
  const ext =
    ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png'
  const key = generateFileKey('assets', `ai_gen_${Date.now()}.${ext}`)
  return uploadFile('assets', key, buf, ct)
}
