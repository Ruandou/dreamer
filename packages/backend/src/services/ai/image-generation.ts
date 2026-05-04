/**
 * @deprecated 图片生成已迁移到 image/ 目录，请从该路径导入
 * 保留此文件以兼容现有调用方
 */

export type {
  TextToImageOptions,
  ImageEditOptions,
  GeneratedImagePersisted
} from './image/image-provider.js'

export {
  ArkImageProvider,
  ArkImageError,
  normalizeArkImageSize,
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale
} from './image/providers/ark-image-provider.js'

export {
  getDefaultImageProvider,
  getImageProviderForUser,
  createArkImageProvider,
  createKlingImageProvider,
  createOpenAIImageProvider
} from './image/image-factory.js'

// 通用图片持久化（Provider 无关）
export async function persistRemoteImageToAssets(remoteUrl: string): Promise<string> {
  const storage = await import('../storage.js')
  const res = await fetch(remoteUrl)
  if (!res.ok) {
    throw new Error(`拉取生成图失败: ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = res.headers.get('content-type') || 'image/png'
  const ext =
    ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png'
  const key = storage.generateFileKey('assets', `ai_gen_${Date.now()}.${ext}`)
  return storage.uploadFile('assets', key, buf, ct)
}

// 兼容旧函数：通过默认 Provider 调用
import { getDefaultImageProvider } from './image/image-factory.js'
import type {
  TextToImageOptions,
  ImageEditOptions,
  GeneratedImagePersisted
} from './image/image-provider.js'

/** @deprecated 使用 ImageProvider.generateTextToImage() */
export async function generateTextToImage(
  prompt: string,
  options?: TextToImageOptions
): Promise<GeneratedImagePersisted> {
  const provider = getDefaultImageProvider()
  const result = await provider.generateTextToImage(prompt, options)
  return { url: result.url, imageCost: result.imageCost }
}

/** @deprecated 使用 ImageProvider.generateImageEdit() */
export async function generateImageEdit(
  referenceImageUrl: string,
  prompt: string,
  options?: ImageEditOptions
): Promise<GeneratedImagePersisted> {
  const provider = getDefaultImageProvider()
  const result = await provider.generateImageEdit(referenceImageUrl, prompt, options)
  return { url: result.url, imageCost: result.imageCost }
}

/** @deprecated 使用 ImageProvider.generateTextToImage() + persistRemoteImageToAssets() */
export async function generateTextToImageAndPersist(
  prompt: string,
  options?: TextToImageOptions
): Promise<GeneratedImagePersisted> {
  const provider = getDefaultImageProvider()
  const result = await provider.generateTextToImage(prompt, options)
  const persisted = await persistRemoteImageToAssets(result.url)
  return { url: persisted, imageCost: result.imageCost }
}

/** @deprecated 使用 ArkImageProvider.remoteImageUrlToDataUrl() */
export async function remoteImageUrlToDataUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  if (!res.ok) {
    throw new Error(`下载参考图失败: ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  const ct = res.headers.get('content-type') || 'image/png'
  const b64 = Buffer.from(buf).toString('base64')
  return `data:${ct};base64,${b64}`
}

/** @deprecated 使用 ImageProvider.generateImageEdit() + persistRemoteImageToAssets() */
export async function generateImageEditAndPersist(
  referenceImageUrl: string,
  prompt: string,
  options?: ImageEditOptions
): Promise<GeneratedImagePersisted> {
  const provider = getDefaultImageProvider()
  const result = await provider.generateImageEdit(referenceImageUrl, prompt, options)
  const persisted = await persistRemoteImageToAssets(result.url)
  return { url: persisted, imageCost: result.imageCost }
}

// 兼容旧常量：根据默认 Provider 动态返回模型名
function resolveDefaultModel(): string {
  const provider = process.env.IMAGE_DEFAULT_PROVIDER || 'ark'
  if (provider === 'kling') {
    return process.env.KLING_IMAGE_T2I_MODEL || 'kling-v3-omni'
  }
  return process.env.ARK_IMAGE_T2I_MODEL || 'doubao-seedream-5-0-lite-260128'
}

export const DEFAULT_T2I_MODEL = resolveDefaultModel()
export const DEFAULT_EDIT_MODEL = resolveDefaultModel()
export const ARK_IMAGE_MIN_TOTAL_PIXELS = 3686400

// 兼容 extractImageCostFromArkResponse
export function extractImageCostFromArkResponse(parsed: Record<string, unknown>): number | null {
  const usage = parsed.usage
  if (!usage || typeof usage !== 'object') {
    const rootTok = readPositiveNumber(parsed.billing_tokens)
    if (!rootTok) return null
    return tokensToEstimatedYuan(rootTok)
  }
  const u = usage as Record<string, unknown>
  let tokens =
    readPositiveNumber(u.total_tokens) ||
    readPositiveNumber(u.billing_tokens) ||
    readPositiveNumber(u.image_tokens)
  if (!tokens) {
    const io = readPositiveNumber(u.input_tokens) + readPositiveNumber(u.output_tokens)
    if (io > 0) tokens = io
  }
  if (!tokens) {
    const pq = readPositiveNumber(u.prompt_tokens) + readPositiveNumber(u.completion_tokens)
    if (pq > 0) tokens = pq
  }
  if (!tokens) return null
  return tokensToEstimatedYuan(tokens)
}

function readPositiveNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

function tokensToEstimatedYuan(tokens: number): number {
  const raw = process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
  const rate = raw != null && raw !== '' ? Number(raw) : 4
  const yuanPerM = Number.isFinite(rate) && rate >= 0 ? rate : 4
  const yuan = (tokens / 1_000_000) * yuanPerM
  return Math.round(yuan * 1_000_000) / 1_000_000
}

// 兼容旧函数
import { normalizeProjectDefaultAspectRatio } from '../../lib/project-aspect.js'
import { normalizeArkImageSize } from './image/providers/ark-image-provider.js'

export function arkImageSizeFromProjectAspectRatio(aspectRatio: string | undefined | null): string {
  const r = normalizeProjectDefaultAspectRatio(aspectRatio)
  const map: Record<string, string> = {
    '9:16': '1440x2560',
    '16:9': '2560x1440',
    '1:1': '1920x1920',
    '4:3': '2220x1665',
    '3:4': '1665x2220',
    '21:9': '4410x1890'
  }
  const raw = map[r]
  return raw ? normalizeArkImageSize(raw) : normalizeArkImageSize('1920x1920')
}

// 兼容 imageJobPrompt / imageJobModel
import type { ImageGenerationJobData } from '@dreamer/shared/types'

export function imageJobPrompt(d: ImageGenerationJobData): string {
  switch (d.kind) {
    case 'character_base_create':
    case 'character_base_regenerate':
    case 'location_establishing':
      return d.prompt
    case 'character_derived_regenerate':
    case 'character_derived_create':
      return d.editPrompt
    default:
      return ''
  }
}

export function imageJobModel(d: ImageGenerationJobData): string {
  switch (d.kind) {
    case 'character_derived_regenerate':
    case 'character_derived_create':
      return DEFAULT_EDIT_MODEL
    default:
      return DEFAULT_T2I_MODEL
  }
}
