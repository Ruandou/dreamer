// Seedance 2.0 API integration (火山方舟/ByteDance)
// 使用 Seedance 2.0-fast 模型，默认 720p 分辨率

const ARK_API_KEY = process.env.ARK_API_KEY || ''
const ARK_API_URL = process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3'
// 锁定模型：Seedance 2.0-fast
const SEEDANCE_MODEL = 'doubao-seedance-2-0-fast-260128'
// 默认分辨率：720p
const DEFAULT_RESOLUTION = '720p'

export interface SeedanceGenerateRequest {
  prompt: string
  imageUrls?: string[]  // 参考图片 URL 数组，最多 9 张
  duration?: number // seconds, default 5, range 4-15
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive'
  resolution?: '480p' | '720p'
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

// 构建火山方舟格式的请求体
function buildArkRequest(request: SeedanceGenerateRequest): any {
  const content = []
  
  // 添加文本提示
  let promptText = request.prompt
  
  // 添加参数到提示词中（火山方舟格式）
  if (request.aspectRatio) {
    promptText += ` --ratio ${request.aspectRatio}`
  }
  promptText += ` --fps 24 --dur ${request.duration || 5}`
  
  content.push({
    type: 'text',
    text: promptText
  })
  
  // 添加参考图片（如果有）
  if (request.imageUrls && request.imageUrls.length > 0) {
    request.imageUrls.forEach(url => {
      content.push({
        type: 'image_url',
        image_url: { url }
      })
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

// 获取认证头（Bearer Token）
function getAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ARK_API_KEY}`
  }
}

export async function submitSeedanceTask(request: SeedanceGenerateRequest): Promise<SeedanceGenerateResponse> {
  const body = buildArkRequest(request)
  const headers = getAuthHeaders()
  
  const response = await fetch(`${ARK_API_URL}/contents/generations/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Seedance 2.0 API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  return {
    taskId: data.id,
    status: 'queued'
  }
}

export async function pollSeedanceStatus(taskId: string): Promise<SeedanceStatusResponse> {
  const headers = getAuthHeaders()
  
  const response = await fetch(`${ARK_API_URL}/contents/generations/tasks/${taskId}`, {
    method: 'GET',
    headers
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

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error('Seedance 2.0 task timeout')
}

// 成本计算（基于火山方舟官方定价）
// 注意：成本按人民币计算，不是美元
export function calculateSeedanceCost(durationSeconds: number): number {
  // Seedance 2.0-fast 定价：5.81 PTC/百万tokens（输入不含视频）
  // 官方估算：15秒视频约30.888万tokens，成本约 ¥15
  // 简化计算：¥1/秒
  const CNY_PER_SECOND = 1.0
  
  return durationSeconds * CNY_PER_SECOND
}
