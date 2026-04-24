/**
 * 可灵 Kling Omni-Image Provider 实现
 * 异步任务模式：创建任务 → 轮询状态
 */

import type {
  ImageProvider,
  ImageProviderConfig,
  TextToImageOptions,
  ImageGenerationResult
} from '../image-provider.js'
import { calculatePerCallCost } from '../../core/cost-calculator.js'

export interface KlingImageTaskResponse {
  taskId: string
  status: 'submitted' | 'processing' | 'succeed' | 'failed'
  url?: string
  error?: string
}

export class KlingImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KlingImageError'
  }
}

export class KlingImageProvider implements ImageProvider {
  readonly name = 'kling'
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
    const model = options.model || this.config.defaultModel || 'kling-image-o1'

    // 1. 创建任务
    const task = await this.createTask({
      model_name: model,
      prompt,
      n: options.n ?? 1,
      aspect_ratio: this.parseSizeToAspectRatio(options.size)
    })

    // 2. 轮询等待完成
    const result = await this.waitForCompletion(task.task_id, 300000) // 5分钟超时

    if (result.status === 'failed' || !result.url) {
      throw new KlingImageError(`可灵图片生成失败: ${result.error || '未知错误'}`)
    }

    // 可灵图片按次计费，单次约 0.2-0.5 元
    const imageCost = 0.3

    return {
      url: result.url,
      imageCost,
      provider: this.name,
      model,
      cost: calculatePerCallCost(imageCost),
      rawResponse: result
    }
  }

  async generateImageEdit(
    _referenceImageUrl: string,
    _prompt: string,
    _options?: TextToImageOptions
  ): Promise<ImageGenerationResult> {
    // 可灵 Omni-Image 暂不支持编辑，可后续扩展
    throw new KlingImageError('可灵图片暂不支持编辑功能')
  }

  // ==================== Kling API 调用 ====================

  private async createTask(params: Record<string, unknown>): Promise<{ task_id: string }> {
    const res = await fetch(`${this.config.baseURL}/v1/images/generations`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(params)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new KlingImageError(`可灵图片 API 错误 ${res.status}: ${text}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const taskId = (data.data as Record<string, unknown>)?.task_id
    if (!taskId) {
      throw new KlingImageError('可灵图片 API 未返回 task_id')
    }
    return { task_id: String(taskId) }
  }

  async queryStatus(taskId: string): Promise<KlingImageTaskResponse> {
    const res = await fetch(`${this.config.baseURL}/v1/images/generations/${taskId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!res.ok) {
      const text = await res.text()
      throw new KlingImageError(`可灵图片查询错误 ${res.status}: ${text}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const taskData = data.data as Record<string, unknown>

    return {
      taskId,
      status: this.mapStatus(String(taskData?.task_status)),
      url: (taskData?.image_url as string) || undefined,
      error: (taskData?.task_status_msg as string) || undefined
    }
  }

  private async waitForCompletion(
    taskId: string,
    maxWaitMs = 300000
  ): Promise<KlingImageTaskResponse> {
    const startTime = Date.now()
    const pollInterval = 3000 // 3 秒轮询

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.queryStatus(taskId)

      if (status.status === 'succeed') {
        return status
      }
      if (status.status === 'failed') {
        return status
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new KlingImageError('可灵图片生成超时')
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new KlingImageError('未配置 API Key，无法调用可灵图片接口')
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`
    }
  }

  private mapStatus(status: string): KlingImageTaskResponse['status'] {
    switch (status?.toLowerCase()) {
      case 'submitted':
        return 'submitted'
      case 'processing':
      case 'running':
        return 'processing'
      case 'succeed':
      case 'success':
      case 'completed':
        return 'succeed'
      case 'failed':
      case 'error':
        return 'failed'
      default:
        return 'processing'
    }
  }

  private parseSizeToAspectRatio(size?: string): string {
    if (!size) return '1:1'
    const normalized = size.toLowerCase().replace(/x/g, ':').replace(/\s/g, '')
    const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9']
    if (validRatios.includes(normalized)) return normalized
    // 尝试从 WxH 计算
    const m = normalized.match(/^(\d+):(\d+)$/)
    if (m) {
      const w = parseInt(m[1], 10)
      const h = parseInt(m[2], 10)
      const ratio = w / h
      if (Math.abs(ratio - 1) < 0.1) return '1:1'
      if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9'
      if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16'
      if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3'
      if (Math.abs(ratio - 3 / 4) < 0.1) return '3:4'
    }
    return '1:1'
  }
}
