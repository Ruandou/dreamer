// Seedance 2.0 API integration (火山引擎/ByteDance)

import { createHmac, createHash } from 'crypto'

const VOLC_ACCESS_KEY = process.env.VOLC_ACCESS_KEY || ''
const VOLC_SECRET_KEY = process.env.VOLC_SECRET_KEY || ''
const VOLC_API_URL = process.env.VOLC_API_URL || 'https://live.volcengineapi.com'

export interface SeedanceGenerateRequest {
  prompt: string
  imageUrls?: string[]  // 参考图片 URL 数组，最多 9 张
  duration?: number // seconds, default 5, range 4-15
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'
  quality?: '480p' | '720p' | '1080p'
  generateAudio?: boolean
}

export interface SeedanceGenerateResponse {
  taskId: string
  status: 'queued' | 'processing'
}

export interface SeedanceStatusResponse {
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}

interface VolcSignedRequest {
  taskId: string
}

// 火山引擎签名认证
function signVolcRequest(method: string, path: string, body: string): { signature: string; timestamp: string; signedHeaders: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // 构造签名字符串
  const stringToSign = [
    method.toUpperCase(),
    path,
    timestamp,
    body
  ].join('\n')

  // HMAC-SHA256 签名
  const signature = createHmac('sha256', VOLC_SECRET_KEY)
    .update(stringToSign)
    .digest('hex')

  return {
    signature,
    timestamp,
    signedHeaders: 'host'
  }
}

function getAuthHeaders(method: string, path: string, body: string = ''): Record<string, string> {
  const { signature, timestamp, signedHeaders } = signVolcRequest(method, path, body)

  // 构造 Authorization header
  const credential = `${VOLC_ACCESS_KEY}/${timestamp}/${signedHeaders}`
  const authorization = `HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    'Authorization': authorization,
    'Content-Type': 'application/json',
    'X-Date': timestamp
  }
}

export async function submitSeedanceTask(request: SeedanceGenerateRequest): Promise<SeedanceGenerateResponse> {
  const body = JSON.stringify({
    model: 'seedance-2.0',
    prompt: request.prompt,
    image_urls: request.imageUrls || [],
    duration: request.duration || 5,
    aspect_ratio: request.aspectRatio || '9:16',
    quality: request.quality || '720p',
    generate_audio: request.generateAudio ?? true
  })

  const path = '/v1/videos/generations'
  const headers = getAuthHeaders('POST', path, body)

  const response = await fetch(`${VOLC_API_URL}${path}`, {
    method: 'POST',
    headers,
    body
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Seedance 2.0 API error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  // 火山引擎返回格式可能是 { id: "task-xxx", status: "pending" }
  return {
    taskId: data.id || data.task_id || data.job_id,
    status: 'queued'
  }
}

export async function pollSeedanceStatus(taskId: string): Promise<SeedanceStatusResponse> {
  const path = `/v1/videos/generations/${taskId}`
  const headers = getAuthHeaders('GET', path)

  const response = await fetch(`${VOLC_API_URL}${path}`, {
    method: 'GET',
    headers
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Seedance 2.0 API error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  // 映射火山引擎响应格式
  return {
    taskId: data.id || taskId,
    status: mapStatus(data.status),
    videoUrl: data.output?.video_url || data.video_url || data.url,
    thumbnailUrl: data.output?.thumbnail_url || data.thumbnail_url,
    error: data.error?.message || data.error || data.message
  }
}

function mapStatus(status: string): 'queued' | 'processing' | 'completed' | 'failed' {
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
    case 'failed':
      return 'failed'
    default:
      return 'processing'
  }
}

export async function waitForSeedanceCompletion(
  taskId: string,
  onProgress?: (status: SeedanceStatusResponse) => void,
  maxWaitMs = 600000
): Promise<SeedanceStatusResponse> {
  const startTime = Date.now()
  const pollInterval = 5000 // 5 秒轮询

  while (Date.now() - startTime < maxWaitMs) {
    const status = await pollSeedanceStatus(taskId)

    onProgress?.(status)

    if (status.status === 'completed') {
      return status
    }

    if (status.status === 'failed') {
      throw new Error(`Seedance 2.0 task failed: ${status.error || 'Unknown error'}`)
    }

    // 等待后继续轮询
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error('Seedance 2.0 task timeout')
}

// Cost calculation (火山引擎定价: 大约 14 credits/秒)
export function calculateSeedanceCost(durationSeconds: number): number {
  const CREDITS_PER_SECOND = 14
  // 假设 1 credit = $0.01 (需要根据实际定价调整)
  const CREDIT_TO_USD = 0.01
  return durationSeconds * CREDITS_PER_SECOND * CREDIT_TO_USD
}
