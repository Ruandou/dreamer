/**
 * Atlas Cloud Video Provider 实现（Wan 2.6）
 */

import type {
  VideoProvider,
  VideoGenerationRequest,
  VideoTaskResponse,
  VideoStatusResponse
} from '../video-provider.js'
import type { ProviderConfig } from '../../core/provider-interface.js'

export class AtlasVideoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AtlasVideoError'
  }
}

export class AtlasVideoProvider implements VideoProvider {
  readonly name = 'atlas'
  readonly type = 'video' as const

  private config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  getConfig(): ProviderConfig {
    return { ...this.config }
  }

  async submitGeneration(request: VideoGenerationRequest): Promise<VideoTaskResponse> {
    const body = this.buildAtlasRequest(request)

    const res = await fetch(`${this.config.baseURL}/v1/video/generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const error = await res.text()
      throw new AtlasVideoError(`Atlas API 错误 ${res.status}: ${error}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    return {
      taskId: String(data.taskId || data.id),
      status: 'queued'
    }
  }

  async queryStatus(taskId: string): Promise<VideoStatusResponse> {
    const res = await fetch(`${this.config.baseURL}/v1/video/status/${taskId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!res.ok) {
      const error = await res.text()
      throw new AtlasVideoError(`Atlas API 错误 ${res.status}: ${error}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    return {
      taskId: String(data.taskId || data.id || taskId),
      status: this.mapStatus(String(data.status)),
      videoUrl: data.videoUrl as string | undefined,
      thumbnailUrl: data.thumbnailUrl as string | undefined,
      error: data.error as string | undefined
    }
  }

  // ==================== 工具方法 ====================

  private buildAtlasRequest(request: VideoGenerationRequest): Record<string, unknown> {
    return {
      prompt: request.prompt,
      ref_image: request.imageUrls?.[0],
      duration: request.duration || 5,
      aspect_ratio: request.aspectRatio || '9:16'
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new AtlasVideoError('未配置 API Key，无法调用 Atlas 接口')
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

/** 成本计算：Wan 2.6 约 $0.07/秒 */
export function calculateWan26Cost(durationSeconds: number): number {
  const COST_PER_SECOND = 0.07
  return durationSeconds * COST_PER_SECOND
}
