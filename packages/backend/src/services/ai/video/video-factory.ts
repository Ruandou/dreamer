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
import { AtlasVideoProvider } from './providers/atlas-video-provider.js'
import { prisma } from '../../../lib/prisma.js'

export type { VideoProvider } from './video-provider.js'
export { registerVideoProvider, createVideoProvider, listVideoProviders, hasVideoProvider }

// 注册 Video Provider
registerVideoProvider('ark', (config) => new ArkVideoProvider(config))
registerVideoProvider('kling', (config) => new KlingVideoProvider(config))
registerVideoProvider('atlas', (config) => new AtlasVideoProvider(config))

/**
 * 获取默认 Video Provider
 */
export function getDefaultVideoProvider() {
  const defaultProvider = process.env.VIDEO_DEFAULT_PROVIDER || 'ark'

  // 尝试新环境变量格式
  const apiKey = process.env[`${defaultProvider.toUpperCase()}_VIDEO_API_KEY`]
  const ak = process.env.KLING_AK
  const sk = process.env.KLING_SK
  if (apiKey || (defaultProvider === 'kling' && ak && sk)) {
    return createVideoProvider({
      provider: defaultProvider,
      apiKey: apiKey || '',
      baseURL: process.env[`${defaultProvider.toUpperCase()}_VIDEO_BASE_URL`] || undefined,
      defaultModel: process.env[`${defaultProvider.toUpperCase()}_VIDEO_MODEL`] || undefined,
      accessKey: ak,
      secretKey: sk
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
    defaultModel: process.env.KLING_VIDEO_MODEL || 'kling-v3-omni',
    accessKey: process.env.KLING_AK,
    secretKey: process.env.KLING_SK
  })
}

export { calculateSeedanceCost } from './providers/ark-video-provider.js'
export { calculateWan26Cost } from './providers/atlas-video-provider.js'

export function createAtlasVideoProvider(apiKey?: string, baseURL?: string) {
  return createVideoProvider({
    provider: 'atlas',
    apiKey: apiKey || process.env.ATLAS_API_KEY || '',
    baseURL: baseURL || process.env.ATLAS_API_URL || 'https://api.atlascloud.com',
    defaultModel: process.env.ATLAS_VIDEO_MODEL || 'wan2.6'
  })
}

/**
 * 获取用户偏好的 Video 模型名称（映射到旧版 VideoModel 类型）
 * @param userId 用户 ID
 * @returns 用户偏好的 VideoModel，若未设置则返回 undefined
 */
export async function resolveVideoModelForUser(
  userId: string
): Promise<'wan2.6' | 'seedance2.0' | undefined> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { modelPreferences: true }
    })

    const preferences = user?.modelPreferences as { videoModel?: string } | undefined
    const videoModel = preferences?.videoModel

    if (videoModel) {
      const map: Record<string, 'wan2.6' | 'seedance2.0'> = {
        'wan2.6': 'wan2.6',
        'doubao-seedance-2-0-fast': 'seedance2.0',
        'kling-video-o1': 'seedance2.0' // TODO: worker 暂未集成 Kling Video，暂 fallback 到 Seedance
      }
      const mapped = map[videoModel]
      if (mapped) return mapped
    }
  } catch (e) {
    console.warn('[video-factory] 读取用户视频模型偏好失败:', e)
  }

  return undefined
}

/**
 * 获取用户偏好的 Video Provider
 * 从数据库读取用户的 modelPreferences，优先使用用户选择的视频模型
 * @param userId 用户 ID
 * @returns 对应模型的 Provider，若用户未设置则返回默认 Provider
 */
export async function getVideoProviderForUser(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { modelPreferences: true }
    })

    const preferences = user?.modelPreferences as { videoModel?: string } | undefined
    const videoModel = preferences?.videoModel

    if (videoModel) {
      // 根据模型 ID 解析 provider
      const modelEntry = [
        { id: 'wan2.6', provider: 'atlas' },
        { id: 'doubao-seedance-2-0-fast', provider: 'ark' },
        { id: 'kling-video-o1', provider: 'kling' }
      ].find((m) => m.id === videoModel)

      if (modelEntry) {
        return createVideoProviderForModel(modelEntry.provider, videoModel)
      }
    }
  } catch (e) {
    console.warn('[video-factory] 读取用户视频模型偏好失败，使用默认 Provider:', e)
  }

  return getDefaultVideoProvider()
}

function createVideoProviderForModel(providerName: string, modelId: string) {
  const ak = process.env.KLING_AK
  const sk = process.env.KLING_SK

  switch (providerName) {
    case 'atlas':
      return createVideoProvider({
        provider: 'atlas',
        apiKey: process.env.ATLAS_API_KEY || '',
        baseURL: process.env.ATLAS_API_URL || 'https://api.atlascloud.com',
        defaultModel: modelId
      })
    case 'ark':
      return createVideoProvider({
        provider: 'ark',
        apiKey: process.env.ARK_VIDEO_API_KEY || process.env.ARK_API_KEY || '',
        baseURL:
          process.env.ARK_VIDEO_BASE_URL ||
          process.env.ARK_API_URL ||
          'https://ark.cn-beijing.volces.com/api/v3',
        defaultModel: modelId
      })
    case 'kling':
      return createVideoProvider({
        provider: 'kling',
        apiKey: process.env.KLING_VIDEO_API_KEY || '',
        baseURL: process.env.KLING_VIDEO_BASE_URL || 'https://api-beijing.klingai.com',
        defaultModel: modelId,
        accessKey: ak,
        secretKey: sk
      })
    default:
      return getDefaultVideoProvider()
  }
}
