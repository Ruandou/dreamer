/**
 * 火山方舟 OpenAI 兼容图片接口（文生图 / 指令编辑）
 * 模型 ID 可通过环境变量覆盖；默认文生图 / 参考图编辑均为方舟 Seedream 5.0 Lite。
 * 若 `ARK_IMAGE_EDIT_MODEL` 指向 SeedEdit，会附带 `guidance_scale`（仅 SeedEdit 路径使用）。
 */
import { uploadFile, generateFileKey } from './storage.js'

const ARK_API_KEY = process.env.ARK_API_KEY || ''
const ARK_API_URL = process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3'

/** 文生图（无参考图） */
export const DEFAULT_T2I_MODEL =
  process.env.ARK_IMAGE_T2I_MODEL || 'doubao-seedream-5-0-lite-260128'
/** 图生图 / 指令编辑（与文生图同一 Lite 模型；可用 ARK_IMAGE_EDIT_MODEL 改回 SeedEdit 等） */
export const DEFAULT_EDIT_MODEL =
  process.env.ARK_IMAGE_EDIT_MODEL || 'doubao-seedream-5-0-lite-260128'

export class ArkImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArkImageError'
  }
}

function getAuthHeaders(): Record<string, string> {
  if (!ARK_API_KEY) {
    throw new ArkImageError('未配置 ARK_API_KEY，无法调用方舟图片接口')
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ARK_API_KEY}`
  }
}

export interface TextToImageOptions {
  size?: string
  n?: number
  model?: string
}

export interface ImageEditOptions {
  model?: string
  size?: string
  /** 0–1，映射为方舟 guidance_scale */
  strength?: number
  watermark?: boolean
}

/** 将「保留程度」粗略映射到 guidance_scale（文档常用 4–8） */
export function strengthToGuidanceScale(strength: number): number {
  const s = Math.min(1, Math.max(0, strength))
  return Math.round(4 + s * 5)
}

/** 仅 SeedEdit 类模型在方舟图片编辑接口中传 guidance_scale */
export function imageEditModelUsesGuidanceScale(model: string): boolean {
  return model.toLowerCase().includes('seededit')
}

async function postImagesGenerations(body: Record<string, unknown>): Promise<{ data: { url: string }[] }> {
  const res = await fetch(`${ARK_API_URL}/images/generations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) {
    throw new ArkImageError(`方舟图片 API 错误 ${res.status}: ${text}`)
  }
  try {
    return JSON.parse(text) as { data: { url: string }[] }
  } catch {
    throw new ArkImageError(`方舟图片 API 返回非 JSON: ${text.slice(0, 200)}`)
  }
}

function firstImageUrl(result: { data: { url: string }[] }): string {
  const url = result.data?.[0]?.url
  if (!url) {
    throw new ArkImageError('方舟图片 API 未返回图片 URL')
  }
  return url
}

/** 下载远程图并转为 data URL，供方舟编辑接口（本地 MinIO 外网不可达时也可用） */
export async function remoteImageUrlToDataUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  if (!res.ok) {
    throw new ArkImageError(`下载参考图失败: ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  const ct = res.headers.get('content-type') || 'image/png'
  const b64 = Buffer.from(buf).toString('base64')
  return `data:${ct};base64,${b64}`
}

/** 将方舟返回的临时 URL 转存到资产桶，避免链接过期 */
export async function persistRemoteImageToAssets(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl)
  if (!res.ok) {
    throw new ArkImageError(`拉取生成图失败: ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = res.headers.get('content-type') || 'image/png'
  const ext = ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png'
  const key = generateFileKey('assets', `ai_gen_${Date.now()}.${ext}`)
  return uploadFile('assets', key, buf, ct)
}

export async function generateTextToImage(prompt: string, options: TextToImageOptions = {}): Promise<string> {
  const body: Record<string, unknown> = {
    model: options.model || DEFAULT_T2I_MODEL,
    prompt,
    size: options.size || '1024x1024',
    n: options.n ?? 1,
    response_format: 'url'
  }
  const json = await postImagesGenerations(body)
  return firstImageUrl(json)
}

export async function generateImageEdit(
  referenceImageUrl: string,
  prompt: string,
  options: ImageEditOptions = {}
): Promise<string> {
  const imagePayload =
    process.env.ARK_IMAGE_EDIT_USE_BASE64 === '0'
      ? referenceImageUrl
      : await remoteImageUrlToDataUrl(referenceImageUrl)

  const model = options.model || DEFAULT_EDIT_MODEL
  const body: Record<string, unknown> = {
    model,
    prompt,
    image: imagePayload,
    response_format: 'url',
    size: options.size || 'adaptive',
    watermark: options.watermark ?? false
  }
  if (imageEditModelUsesGuidanceScale(model)) {
    body.guidance_scale = strengthToGuidanceScale(options.strength ?? 0.35)
  }
  const json = await postImagesGenerations(body)
  return firstImageUrl(json)
}

export async function generateTextToImageAndPersist(
  prompt: string,
  options?: TextToImageOptions
): Promise<string> {
  const url = await generateTextToImage(prompt, options)
  return persistRemoteImageToAssets(url)
}

export async function generateImageEditAndPersist(
  referenceImageUrl: string,
  prompt: string,
  options?: ImageEditOptions
): Promise<string> {
  const url = await generateImageEdit(referenceImageUrl, prompt, options)
  return persistRemoteImageToAssets(url)
}
