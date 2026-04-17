/**
 * 火山方舟 OpenAI 兼容图片接口（文生图 / 指令编辑）
 * 模型 ID 可通过环境变量覆盖；默认文生图 / 参考图编辑均为方舟 Seedream 5.0 Lite。
 * 若 `ARK_IMAGE_EDIT_MODEL` 指向 SeedEdit，会附带 `guidance_scale`（仅 SeedEdit 路径使用）。
 *
 * `size`：方舟返回 InvalidParameter 时常见「总像素须 ≥ 3686400」（约 1920×1920），
 * 故默认与过小尺寸会规范化为 `1920x1920`；`adaptive` 在部分模型上可能低于下限，一并提升。
 */
import { uploadFile, generateFileKey } from '../storage.js'
import { normalizeProjectDefaultAspectRatio } from '../../lib/project-aspect.js'
import type { ImageGenerationJobData } from '@dreamer/shared/types'

const ARK_API_KEY = process.env.ARK_API_KEY || ''
const ARK_API_URL = process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3'

/** 文生图（无参考图） */
export const DEFAULT_T2I_MODEL =
  process.env.ARK_IMAGE_T2I_MODEL || 'doubao-seedream-5-0-lite-260128'
/** 图生图 / 指令编辑（与文生图同一 Lite 模型；可用 ARK_IMAGE_EDIT_MODEL 改回 SeedEdit 等） */
export const DEFAULT_EDIT_MODEL =
  process.env.ARK_IMAGE_EDIT_MODEL || 'doubao-seedream-5-0-lite-260128'

/** Bull 图片任务日志 / Worker 用的 prompt 摘要（纯函数，可单测） */
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

export class ArkImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArkImageError'
  }
}

/** 方舟 images/generations 对 `WxH` 总像素下限（错误文案：at least 3686400 pixels） */
export const ARK_IMAGE_MIN_TOTAL_PIXELS = 3686400

const DEFAULT_ARK_IMAGE_SIZE = '1920x1920'

/**
 * 将请求中的 size 规范为方舟可接受的 WxH；低于下限或 adaptive/非法时退回默认。
 */
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

/** 按项目默认画幅得到方舟 `size`（WxH），满足总像素下限 */
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
  return raw ? normalizeArkImageSize(raw) : normalizeArkImageSize(DEFAULT_ARK_IMAGE_SIZE)
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
  /** 默认 false，与编辑接口一致，避免方舟返回带平台水印的图 */
  watermark?: boolean
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

function readPositiveNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

/**
 * 从方舟 images/generations JSON 根对象解析 token 用量并换算为人民币（估算）。
 * 未返回 usage 时得到 null；单价由 `ARK_IMAGE_YUAN_PER_MILLION_TOKENS` 配置（默认 4，即每百万 token 约 4 元，可按控制台账单调整）。
 */
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

function tokensToEstimatedYuan(tokens: number): number {
  const raw = process.env.ARK_IMAGE_YUAN_PER_MILLION_TOKENS
  const rate = raw != null && raw !== '' ? Number(raw) : 4
  const yuanPerM = Number.isFinite(rate) && rate >= 0 ? rate : 4
  const yuan = (tokens / 1_000_000) * yuanPerM
  return Math.round(yuan * 1_000_000) / 1_000_000
}

async function postImagesGenerations(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
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
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new ArkImageError(`方舟图片 API 返回非 JSON: ${text.slice(0, 200)}`)
  }
}

function firstImageUrl(result: Record<string, unknown>): string {
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

/** 文生图 / 图生图成功并落库后的 URL 与估算成本（元） */
export interface GeneratedImagePersisted {
  url: string
  imageCost: number | null
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
  const ext =
    ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png'
  const key = generateFileKey('assets', `ai_gen_${Date.now()}.${ext}`)
  return uploadFile('assets', key, buf, ct)
}

export async function generateTextToImage(
  prompt: string,
  options: TextToImageOptions = {}
): Promise<GeneratedImagePersisted> {
  const body: Record<string, unknown> = {
    model: options.model || DEFAULT_T2I_MODEL,
    prompt,
    size: normalizeArkImageSize(options.size),
    n: options.n ?? 1,
    response_format: 'url',
    watermark: options.watermark ?? false
  }
  const json = await postImagesGenerations(body)
  return {
    url: firstImageUrl(json),
    imageCost: extractImageCostFromArkResponse(json)
  }
}

export async function generateImageEdit(
  referenceImageUrl: string,
  prompt: string,
  options: ImageEditOptions = {}
): Promise<GeneratedImagePersisted> {
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
    size: normalizeArkImageSize(options.size || 'adaptive'),
    watermark: options.watermark ?? false
  }
  if (imageEditModelUsesGuidanceScale(model)) {
    body.guidance_scale = strengthToGuidanceScale(options.strength ?? 0.35)
  }
  const json = await postImagesGenerations(body)
  return {
    url: firstImageUrl(json),
    imageCost: extractImageCostFromArkResponse(json)
  }
}

export async function generateTextToImageAndPersist(
  prompt: string,
  options?: TextToImageOptions
): Promise<GeneratedImagePersisted> {
  const { url, imageCost } = await generateTextToImage(prompt, options)
  const persisted = await persistRemoteImageToAssets(url)
  return { url: persisted, imageCost }
}

export async function generateImageEditAndPersist(
  referenceImageUrl: string,
  prompt: string,
  options?: ImageEditOptions
): Promise<GeneratedImagePersisted> {
  const { url, imageCost } = await generateImageEdit(referenceImageUrl, prompt, options)
  const persisted = await persistRemoteImageToAssets(url)
  return { url: persisted, imageCost }
}
