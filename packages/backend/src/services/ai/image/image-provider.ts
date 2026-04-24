/**
 * Image Provider 接口
 * 文生图 / 图生图统一抽象
 */

import type { BaseProvider, ProviderConfig, ApiCallResult } from '../core/provider-interface.js'

export type { ProviderConfig }

export interface GeneratedImagePersisted {
  url: string
  imageCost: number | null
}

export interface TextToImageOptions {
  size?: string
  n?: number
  model?: string
  watermark?: boolean
}

export interface ImageEditOptions {
  model?: string
  size?: string
  strength?: number
  watermark?: boolean
}

export interface ImageGenerationResult extends ApiCallResult {
  url: string
  imageCost: number | null
}

/** Image Provider 接口 */
export interface ImageProvider extends BaseProvider {
  readonly type: 'image'
  generateTextToImage(prompt: string, options?: TextToImageOptions): Promise<ImageGenerationResult>
  generateImageEdit(
    referenceImageUrl: string,
    prompt: string,
    options?: ImageEditOptions
  ): Promise<ImageGenerationResult>
}

export interface ImageProviderConfig extends ProviderConfig {
  t2iModel?: string
  editModel?: string
}

export type ImageProviderFactory = (config: ImageProviderConfig) => ImageProvider
