/**
 * Video Provider 接口
 * 视频生成统一抽象（异步任务模式）
 */

import type { BaseProvider, ProviderConfig } from '../core/provider-interface.js'

export type { ProviderConfig }

export interface VideoGenerationRequest {
  prompt: string
  model?: string
  imageUrls?: string[]
  videoUrl?: string
  duration?: number
  aspectRatio?: string
  mode?: 'std' | 'pro' | '4k'
  sound?: 'on' | 'off'
  // Kling 特有
  multiShot?: boolean
  shotType?: 'customize' | 'intelligence'
  multiPrompt?: Array<{ index: number; prompt: string; duration: string }>
  // Seedance 特有
  generateAudio?: boolean
  audioConfig?: {
    type: 'tts'
    segments: Array<{
      character_tag: string
      text: string
      voice_config: Record<string, unknown>
      start_time: number
      duration: number
    }>
  }
}

export interface VideoTaskResponse {
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}

export interface VideoStatusResponse extends VideoTaskResponse {
  progress?: number
}

/** Video Provider 接口 */
export interface VideoProvider extends BaseProvider {
  readonly type: 'video'
  submitGeneration(request: VideoGenerationRequest): Promise<VideoTaskResponse>
  queryStatus(taskId: string): Promise<VideoStatusResponse>
  cancelTask?(taskId: string): Promise<void>
}

export type VideoProviderFactory = (config: ProviderConfig) => VideoProvider
