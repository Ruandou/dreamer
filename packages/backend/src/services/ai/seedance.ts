/**
 * @deprecated 视频生成已迁移到 video/ 目录，请从该路径导入
 * 保留此文件以兼容现有调用方
 */

export type {
  VideoGenerationRequest as SeedanceGenerateRequest,
  VideoTaskResponse as SeedanceGenerateResponse,
  VideoStatusResponse as SeedanceStatusResponse
} from './video/video-provider.js'

export {
  ArkVideoProvider,
  ArkVideoError,
  calculateSeedanceCost,
  imageUrlsToBase64,
  imageUrlToBase64
} from './video/providers/ark-video-provider.js'

export {
  getDefaultVideoProvider,
  createArkVideoProvider,
  createKlingVideoProvider
} from './video/video-factory.js'

// 兼容旧常量
export const SEEDANCE_MODEL = 'doubao-seedance-2-0-fast-260128'
export const DEFAULT_RESOLUTION = '720p'

// 兼容旧函数 - 保持原有实现以确保测试通过
const ARK_API_KEY = process.env.ARK_API_KEY || ''
const ARK_API_URL = process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3'

function getAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ARK_API_KEY}`
  }
}

function buildArkRequest(request: {
  prompt: string
  imageUrls?: string[]
  imageBase64?: string[]
  duration?: number
  aspectRatio?: string
  resolution?: string
  generateAudio?: boolean
  audioConfig?: { type: 'tts'; segments: Array<Record<string, unknown>> }
}): Record<string, unknown> {
  const content = []
  let promptText = request.prompt
  if (request.aspectRatio) {
    promptText += ` --ratio ${request.aspectRatio}`
  }
  promptText += ` --fps 24 --dur ${request.duration || 5}`
  content.push({ type: 'text', text: promptText })

  if (request.imageUrls && request.imageUrls.length > 0) {
    request.imageUrls.forEach((url) => {
      content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' })
    })
  }
  if (request.imageBase64 && request.imageBase64.length > 0) {
    request.imageBase64.forEach((b64) => {
      content.push({ type: 'image_url', image_url: { url: b64 }, role: 'reference_image' })
    })
  }

  return {
    model: SEEDANCE_MODEL,
    content,
    duration: request.duration || 5,
    resolution: request.resolution || DEFAULT_RESOLUTION,
    ratio: request.aspectRatio || '9:16',
    generate_audio: request.generateAudio ?? true,
    watermark: false
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
      return 'failed'
    default:
      return 'processing'
  }
}

/** @deprecated 使用 VideoProvider.submitGeneration() */
export async function submitSeedanceTask(request: {
  prompt: string
  imageUrls?: string[]
  imageBase64?: string[]
  duration?: number
  aspectRatio?: string
  resolution?: string
  generateAudio?: boolean
  audioConfig?: { type: 'tts'; segments: Array<Record<string, unknown>> }
}): Promise<{ taskId: string; status: 'queued' | 'processing' }> {
  const body = buildArkRequest(request)
  const response = await fetch(`${ARK_API_URL}/contents/generations/tasks`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Seedance 2.0 API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return { taskId: data.id, status: 'queued' }
}

/** @deprecated 使用 VideoProvider.queryStatus() */
export async function pollSeedanceStatus(taskId: string): Promise<{
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}> {
  const response = await fetch(`${ARK_API_URL}/contents/generations/tasks/${taskId}`, {
    method: 'GET',
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Seedance 2.0 API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return {
    taskId: data.id,
    status: mapStatus(data.status),
    videoUrl: data.content?.video_url,
    thumbnailUrl: data.content?.thumbnail_url,
    error: data.error?.message || data.error
  }
}

/** @deprecated 使用 VideoProvider.queryStatus() + 轮询 */
export async function waitForSeedanceCompletion(
  taskId: string,
  onProgress?: (status: {
    taskId: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    videoUrl?: string
    thumbnailUrl?: string
    error?: string
  }) => void,
  maxWaitMs = 600000
): Promise<{
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}> {
  const startTime = Date.now()
  const pollInterval = 5000

  while (Date.now() - startTime < maxWaitMs) {
    const status = await pollSeedanceStatus(taskId)
    onProgress?.(status)

    if (status.status === 'completed') {
      return status
    }
    if (status.status === 'failed') {
      throw new Error(`Seedance 2.0 task failed: ${status.error || 'Unknown error'}`)
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error('Seedance 2.0 task timeout')
}
