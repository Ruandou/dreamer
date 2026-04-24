/**
 * Image 模块统一导出
 */

export type {
  ImageProvider,
  ImageProviderConfig,
  TextToImageOptions,
  ImageEditOptions,
  ImageGenerationResult,
  ImageProviderFactory
} from './image-provider.js'

export {
  imageRegistry,
  registerImageProvider,
  createImageProvider,
  listImageProviders,
  hasImageProvider
} from './image-registry.js'

export {
  getDefaultImageProvider,
  createArkImageProvider,
  createKlingImageProvider,
  createOpenAIImageProvider
} from './image-factory.js'

export {
  ArkImageProvider,
  ArkImageError,
  normalizeArkImageSize,
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale,
  persistRemoteImageToAssets
} from './providers/ark-image-provider.js'

export {
  KlingImageProvider,
  KlingImageError,
  type KlingImageTaskResponse
} from './providers/kling-image-provider.js'

export { OpenAIImageProvider, OpenAIImageError } from './providers/openai-image-provider.js'
