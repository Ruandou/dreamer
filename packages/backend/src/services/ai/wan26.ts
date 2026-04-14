// Wan 2.6 API integration (Atlas Cloud)

const ATLAS_API_KEY = process.env.ATLAS_API_KEY
const ATLAS_API_URL = process.env.ATLAS_API_URL || 'https://api.atlascloud.com'

export interface Wan26GenerateRequest {
  prompt: string
  referenceImage?: string
  duration?: number // seconds, default 5
  aspectRatio?: '16:9' | '9:16' | '1:1'
}

export interface Wan26GenerateResponse {
  taskId: string
  status: 'queued' | 'processing'
}

export interface Wan26StatusResponse {
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}

export async function submitWan26Task(request: Wan26GenerateRequest): Promise<Wan26GenerateResponse> {
  const response = await fetch(`${ATLAS_API_URL}/v1/video/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ATLAS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: request.prompt,
      ref_image: request.referenceImage,
      duration: request.duration || 5,
      aspect_ratio: request.aspectRatio || '9:16'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Wan 2.6 API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export async function pollWan26Status(taskId: string): Promise<Wan26StatusResponse> {
  const response = await fetch(`${ATLAS_API_URL}/v1/video/status/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ATLAS_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Wan 2.6 API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export async function waitForWan26Completion(taskId: string, maxWaitMs = 600000): Promise<Wan26StatusResponse> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const status = await pollWan26Status(taskId)

    if (status.status === 'completed') {
      return status
    }

    if (status.status === 'failed') {
      throw new Error(`Wan 2.6 task failed: ${status.error}`)
    }

    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  throw new Error('Wan 2.6 task timeout')
}

// Cost calculation
export function calculateWan26Cost(durationSeconds: number): number {
  const COST_PER_SECOND = 0.07
  return durationSeconds * COST_PER_SECOND
}
