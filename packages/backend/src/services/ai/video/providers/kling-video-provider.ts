/**
 * 可灵 Kling Omni-Video Provider 实现
 * 异步任务模式，支持多镜头、首尾帧、视频编辑
 */

import type {
  VideoProvider,
  VideoGenerationRequest,
  VideoTaskResponse,
  VideoStatusResponse
} from '../video-provider.js'
import type { ProviderConfig } from '../../core/provider-interface.js'
// calculateDurationCost available in cost-calculator when needed

export class KlingVideoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KlingVideoError'
  }
}

export class KlingVideoProvider implements VideoProvider {
  readonly name = 'kling'
  readonly type = 'video' as const

  private config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  getConfig(): ProviderConfig {
    return { ...this.config }
  }

  async submitGeneration(request: VideoGenerationRequest): Promise<VideoTaskResponse> {
    const model = request.model || this.config.defaultModel || 'kling-video-o1'

    const body = this.buildKlingRequest(request, model)
    const res = await fetch(`${this.config.baseURL}/v1/videos/generations`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new KlingVideoError(`可灵视频 API 错误 ${res.status}: ${text}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const taskId = (data.data as Record<string, unknown>)?.task_id
    if (!taskId) {
      throw new KlingVideoError('可灵视频 API 未返回 task_id')
    }

    return {
      taskId: String(taskId),
      status: 'queued'
    }
  }

  async queryStatus(taskId: string): Promise<VideoStatusResponse> {
    const res = await fetch(`${this.config.baseURL}/v1/videos/generations/${taskId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!res.ok) {
      const text = await res.text()
      throw new KlingVideoError(`可灵视频查询错误 ${res.status}: ${text}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const taskData = data.data as Record<string, unknown>

    return {
      taskId,
      status: this.mapStatus(String(taskData?.task_status)),
      videoUrl: (taskData?.video_url as string) || undefined,
      thumbnailUrl: (taskData?.thumbnail_url as string) || undefined,
      error: (taskData?.task_status_msg as string) || undefined,
      progress: typeof taskData?.progress === 'number' ? taskData.progress : undefined
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    const res = await fetch(`${this.config.baseURL}/v1/videos/generations/${taskId}/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })

    if (!res.ok) {
      const text = await res.text()
      throw new KlingVideoError(`可灵视频取消错误 ${res.status}: ${text}`)
    }
  }

  /**
   * 等待任务完成（轮询）
   */
  async waitForCompletion(
    taskId: string,
    maxWaitMs = 600000,
    onProgress?: (status: VideoStatusResponse) => void
  ): Promise<VideoStatusResponse> {
    const startTime = Date.now()
    const pollInterval = 5000 // 5 秒轮询

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.queryStatus(taskId)
      onProgress?.(status)

      if (status.status === 'completed') {
        return status
      }
      if (status.status === 'failed') {
        throw new KlingVideoError(`可灵视频生成失败: ${status.error || '未知错误'}`)
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new KlingVideoError('可灵视频生成超时')
  }

  // ==================== 内部方法 ====================

  private buildKlingRequest(
    request: VideoGenerationRequest,
    model: string
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model_name: model,
      prompt: request.prompt,
      mode: request.mode || 'std',
      sound: request.sound || 'on'
    }

    // 画幅
    if (request.aspectRatio) {
      body.aspect_ratio = request.aspectRatio
    }

    // 时长
    if (request.duration) {
      body.duration = request.duration
    }

    // 多镜头模式
    if (request.multiShot) {
      body.multi_shot = true
      body.shot_type = request.shotType || 'customize'
      if (request.multiPrompt && request.multiPrompt.length > 0) {
        body.multi_prompt = request.multiPrompt
      }
    }

    // 参考图（支持首尾帧）
    if (request.imageUrls && request.imageUrls.length > 0) {
      const imageList = request.imageUrls.map((url, index) => ({
        url,
        type:
          index === 0
            ? 'first_frame'
            : index === (request.imageUrls ?? []).length - 1
              ? 'end_frame'
              : 'reference'
      }))
      body.image_list = imageList
    }

    // 参考视频（视频编辑）
    if (request.videoUrl) {
      body.video_list = [
        {
          url: request.videoUrl,
          refer_type: 'base' // 待编辑视频
        }
      ]
    }

    return body
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new KlingVideoError('未配置 API Key，无法调用可灵视频接口')
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`
    }
  }

  private mapStatus(status: string): VideoStatusResponse['status'] {
    switch (status?.toLowerCase()) {
      case 'submitted':
      case 'queued':
      case 'pending':
        return 'queued'
      case 'processing':
      case 'running':
        return 'processing'
      case 'succeed':
      case 'success':
      case 'completed':
        return 'completed'
      case 'failed':
      case 'error':
        return 'failed'
      default:
        return 'processing'
    }
  }
}
