/**
 * AI 服务统一入口
 * 所有 Provider（LLM / Image / Video / Search）统一导出
 */

// Core 抽象层
export type {
  ProviderType,
  ProviderConfig,
  BaseProvider,
  CostResult,
  ApiCallResult,
  ProviderFactory
} from './core/provider-interface.js'
export { ProviderRegistry } from './core/provider-registry.js'
export {
  createProvider,
  createProviderFromEnv,
  getDefaultProvider as getDefaultProviderFromCore
} from './core/provider-factory.js'
export type { CostCalculator, TokenPricing } from './core/cost-calculator.js'
export {
  calculateTokenCost,
  calculatePerCallCost,
  calculateDurationCost,
  calculateTokenQuantityCost
} from './core/cost-calculator.js'

// LLM 模块
export type {
  LLMProvider,
  LLMProviderConfig,
  LLMMessage,
  LLMCompletion,
  LLMCompletionOptions,
  LLMUsage,
  LLMStreamChunk,
  LLMProviderFactory
} from './llm/llm-provider.js'
export {
  llmRegistry,
  registerLLMProvider,
  createLLMProvider,
  listLLMProviders,
  hasLLMProvider
} from './llm/llm-registry.js'
export {
  getDefaultProvider,
  createDeepSeekProvider,
  createOpenAIProvider,
  createArkLLMProvider
} from './llm/llm-factory.js'
export {
  callLLMWithRetry,
  streamLLMWithRetry,
  collectStreamedJSON,
  parseJsonResponse,
  cleanMarkdownCodeBlocks
} from './llm/llm-call-wrapper.js'
export type { LLMCallOptions, LLMCallResult } from './llm/llm-call-wrapper.js'
export { logLLMCall, logDeepSeekChat } from './llm/model-call-log.js'
export type { ModelCallLogContext } from './llm/model-call-log.js'
export {
  ALL_LLM_MODELS,
  getModelsByProvider,
  getModelInfo,
  getModelPricing,
  resolveDeepSeekModel,
  getDeepSeekPricing,
  getOpenAIPricing,
  getClaudePricing,
  getQwenPricing,
  getArkLLMPricing
} from './llm/llm-model-catalog.js'
export type { ModelInfo } from './llm/llm-model-catalog.js'
export {
  DeepSeekProvider,
  DeepSeekAuthError,
  DeepSeekRateLimitError
} from './llm/providers/deepseek-provider.js'
export {
  OpenAIProvider,
  OpenAIAuthError,
  OpenAIRateLimitError
} from './llm/providers/openai-provider.js'
export {
  ArkLLMProvider,
  ArkLLMAuthError,
  ArkLLMRateLimitError
} from './llm/providers/ark-llm-provider.js'

// Image 模块
export type {
  ImageProvider,
  ImageProviderConfig,
  TextToImageOptions,
  ImageEditOptions,
  ImageGenerationResult,
  GeneratedImagePersisted,
  ImageProviderFactory
} from './image/image-provider.js'
export {
  imageRegistry,
  registerImageProvider,
  createImageProvider,
  listImageProviders,
  hasImageProvider
} from './image/image-registry.js'
export {
  getDefaultImageProvider,
  createArkImageProvider,
  createKlingImageProvider,
  createOpenAIImageProvider
} from './image/image-factory.js'
export {
  ArkImageProvider,
  ArkImageError,
  normalizeArkImageSize,
  strengthToGuidanceScale,
  imageEditModelUsesGuidanceScale,
  persistRemoteImageToAssets
} from './image/providers/ark-image-provider.js'
export {
  KlingImageProvider,
  KlingImageError,
  type KlingImageTaskResponse
} from './image/providers/kling-image-provider.js'
export { OpenAIImageProvider, OpenAIImageError } from './image/providers/openai-image-provider.js'

// Video 模块
export type {
  VideoProvider,
  VideoGenerationRequest,
  VideoTaskResponse,
  VideoStatusResponse,
  VideoProviderFactory
} from './video/video-provider.js'
export {
  videoRegistry,
  registerVideoProvider,
  createVideoProvider,
  listVideoProviders,
  hasVideoProvider
} from './video/video-registry.js'
export {
  getDefaultVideoProvider,
  createArkVideoProvider,
  createKlingVideoProvider
} from './video/video-factory.js'
export {
  ArkVideoProvider,
  ArkVideoError,
  calculateSeedanceCost,
  imageUrlsToBase64,
  imageUrlToBase64
} from './video/providers/ark-video-provider.js'
export { KlingVideoProvider, KlingVideoError } from './video/providers/kling-video-provider.js'

// Search 模块
export type {
  SearchProvider,
  WebSearchOptions,
  WebItem,
  WebSearchResult,
  WebSearchSummaryResult,
  ImageSearchItem,
  ImageSearchResult,
  SearchProviderFactory
} from './search/search-provider.js'
export {
  searchRegistry,
  registerSearchProvider,
  createSearchProvider,
  listSearchProviders,
  hasSearchProvider
} from './search/search-registry.js'
export { getDefaultSearchProvider, createVolcSearchProvider } from './search/search-factory.js'
export { VolcSearchProvider, VolcSearchError } from './search/providers/volc-search-provider.js'

// API 日志（保持兼容）
export {
  recordModelApiCall,
  logApiCall,
  updateApiCall,
  getApiCalls,
  truncateForModelLog,
  parseModelApiRequestParams,
  MODEL_LOG_PROMPT_MAX,
  MODEL_LOG_RESPONSE_MAX,
  MODEL_LOG_ERROR_MAX
} from './api-logger.js'
export type {
  ModelCallLogContext as ApiLoggerModelCallLogContext,
  RecordModelApiCallInput,
  ApiCallParams,
  ApiCallResult as ApiLoggerApiCallResult
} from './api-logger.js'
