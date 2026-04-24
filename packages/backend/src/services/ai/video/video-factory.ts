/**
 * Video Provider Factory
 */

import {
  registerVideoProvider,
  createVideoProvider,
  listVideoProviders,
  hasVideoProvider
} from './video-registry.js'
import { ArkVideoProvider } from './providers/ark-video-provider.js'
import { KlingVideoProvider } from './providers/kling-video-provider.js'

export type { VideoProvider } from './video-provider.js'
export { registerVideoProvider, createVideoProvider, listVideoProviders, hasVideoProvider }

// 注册 Video Provider
registerVideoProvider('ark', (config) => new ArkVideoProvider(config))
registerVideoProvider('kling', (config) => new KlingVideoProvider(config))

/**
 * 获取默认 Video Provider
 */
export function getDefaultVideoProvider() {
  const defaultProvider = process.env.VIDEO_DEFAULT_PROVIDER || 'ark'

  // 尝试新环境变量格式
  const apiKey = process.env[`${defaultProvider.toUpperCase()}_VIDEO_API_KEY`]
  if (apiKey) {
    return createVideoProvider({
      provider: defaultProvider,
      apiKey,
      baseURL: process.env[`${defaultProvider.toUpperCase()}_VIDEO_BASE_URL`] || undefined,
      defaultModel: process.env[`${defaultProvider.toUpperCase()}_VIDEO_MODEL`] || undefined
    })
  }

  // 兼容旧版方舟配置
  const arkKey = process.env.ARK_API_KEY || process.env.ARK_VIDEO_API_KEY
  if (arkKey) {
    return createVideoProvider({
      provider: 'ark',
      apiKey: arkKey,
      baseURL:
        process.env.ARK_API_URL ||
        process.env.ARK_VIDEO_BASE_URL ||
        'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: process.env.ARK_VIDEO_MODEL || 'doubao-seedance-2-0-fast-260128'
    })
  }

  throw new Error(
    'No Video API key configured. Please set VIDEO_DEFAULT_PROVIDER and <PROVIDER>_VIDEO_API_KEY, ' +
      'or ARK_API_KEY in your .env file.'
  )
}

export function createArkVideoProvider(apiKey?: string, baseURL?: string) {
  return createVideoProvider({
    provider: 'ark',
    apiKey: apiKey || process.env.ARK_VIDEO_API_KEY || process.env.ARK_API_KEY || '',
    baseURL:
      baseURL ||
      process.env.ARK_VIDEO_BASE_URL ||
      process.env.ARK_API_URL ||
      'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: process.env.ARK_VIDEO_MODEL || 'doubao-seedance-2-0-fast-260128'
  })
}

export function createKlingVideoProvider(apiKey?: string, baseURL?: string) {
  return createVideoProvider({
    provider: 'kling',
    apiKey: apiKey || process.env.KLING_VIDEO_API_KEY || '',
    baseURL: baseURL || process.env.KLING_VIDEO_BASE_URL || 'https://api-beijing.klingai.com',
    defaultModel: process.env.KLING_VIDEO_MODEL || 'kling-video-o1'
  })
}
