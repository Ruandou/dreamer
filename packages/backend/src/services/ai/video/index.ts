/**
 * Video 模块统一导出
 */

export type {
  VideoProvider,
  VideoGenerationRequest,
  VideoTaskResponse,
  VideoStatusResponse,
  VideoProviderFactory
} from './video-provider.js'

export {
  videoRegistry,
  registerVideoProvider,
  createVideoProvider,
  listVideoProviders,
  hasVideoProvider
} from './video-registry.js'

export {
  getDefaultVideoProvider,
  createArkVideoProvider,
  createKlingVideoProvider
} from './video-factory.js'

export {
  ArkVideoProvider,
  ArkVideoError,
  calculateSeedanceCost,
  imageUrlsToBase64,
  imageUrlToBase64
} from './providers/ark-video-provider.js'

export { KlingVideoProvider, KlingVideoError } from './providers/kling-video-provider.js'
