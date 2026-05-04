/**
 * Image Provider Factory
 */

import {
  imageRegistry,
  registerImageProvider,
  createImageProvider,
  listImageProviders,
  hasImageProvider
} from './image-registry.js'
import { ArkImageProvider } from './providers/ark-image-provider.js'
import { KlingImageProvider } from './providers/kling-image-provider.js'
import { OpenAIImageProvider } from './providers/openai-image-provider.js'

export type { ImageProvider } from './image-provider.js'
export {
  registerImageProvider,
  createImageProvider,
  imageRegistry,
  listImageProviders,
  hasImageProvider
}

// 注册所有 Image Provider
registerImageProvider('ark', (config) => new ArkImageProvider(config))
registerImageProvider('kling', (config) => new KlingImageProvider(config))
registerImageProvider('openai', (config) => new OpenAIImageProvider(config))

/**
 * 获取默认 Image Provider
 */
export function getDefaultImageProvider() {
  const defaultProvider = process.env.IMAGE_DEFAULT_PROVIDER || 'ark'

  // 尝试新环境变量格式
  const apiKey = process.env[`${defaultProvider.toUpperCase()}_IMAGE_API_KEY`]
  const ak = process.env.KLING_AK
  const sk = process.env.KLING_SK
  if (apiKey || (defaultProvider === 'kling' && ak && sk)) {
    return createImageProvider({
      provider: defaultProvider,
      apiKey: apiKey || '',
      baseURL: process.env[`${defaultProvider.toUpperCase()}_IMAGE_BASE_URL`] || undefined,
      defaultModel: process.env[`${defaultProvider.toUpperCase()}_IMAGE_T2I_MODEL`] || undefined,
      accessKey: ak,
      secretKey: sk
    })
  }

  // 兼容旧版方舟配置
  const arkKey = process.env.ARK_API_KEY || process.env.ARK_IMAGE_API_KEY
  if (arkKey) {
    return createImageProvider({
      provider: 'ark',
      apiKey: arkKey,
      baseURL:
        process.env.ARK_API_URL ||
        process.env.ARK_IMAGE_BASE_URL ||
        'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: process.env.ARK_IMAGE_T2I_MODEL || 'doubao-seedream-5-0-lite-260128'
    })
  }

  throw new Error(
    'No Image API key configured. Please set IMAGE_DEFAULT_PROVIDER and <PROVIDER>_IMAGE_API_KEY, ' +
      'or ARK_API_KEY in your .env file.'
  )
}

export function createArkImageProvider(apiKey?: string, baseURL?: string) {
  return createImageProvider({
    provider: 'ark',
    apiKey: apiKey || process.env.ARK_IMAGE_API_KEY || process.env.ARK_API_KEY || '',
    baseURL:
      baseURL ||
      process.env.ARK_IMAGE_BASE_URL ||
      process.env.ARK_API_URL ||
      'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: process.env.ARK_IMAGE_T2I_MODEL || 'doubao-seedream-5-0-lite-260128'
  })
}

export function createKlingImageProvider(apiKey?: string, baseURL?: string) {
  return createImageProvider({
    provider: 'kling',
    apiKey: apiKey || process.env.KLING_IMAGE_API_KEY || '',
    baseURL: baseURL || process.env.KLING_IMAGE_BASE_URL || 'https://api-beijing.klingai.com',
    defaultModel: process.env.KLING_IMAGE_T2I_MODEL || 'kling-v3-omni',
    accessKey: process.env.KLING_AK,
    secretKey: process.env.KLING_SK
  })
}

export function createOpenAIImageProvider(apiKey?: string, baseURL?: string) {
  return createImageProvider({
    provider: 'openai',
    apiKey: apiKey || process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY || '',
    baseURL:
      baseURL ||
      process.env.OPENAI_IMAGE_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_IMAGE_T2I_MODEL || 'dall-e-3'
  })
}
