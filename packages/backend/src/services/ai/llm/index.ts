/**
 * LLM 模块统一导出
 */

export type {
  LLMProvider,
  LLMProviderConfig,
  LLMMessage,
  LLMCompletion,
  LLMCompletionOptions,
  LLMUsage,
  LLMStreamChunk,
  LLMProviderFactory
} from './llm-provider.js'

export {
  llmRegistry,
  registerLLMProvider,
  createLLMProvider,
  listLLMProviders,
  hasLLMProvider
} from './llm-registry.js'

export {
  getDefaultProvider,
  createDeepSeekProvider,
  createOpenAIProvider,
  createArkLLMProvider
} from './llm-factory.js'

export {
  callLLMWithRetry,
  streamLLMWithRetry,
  collectStreamedJSON,
  parseJsonResponse,
  cleanMarkdownCodeBlocks
} from './llm-call-wrapper.js'
export type { LLMCallOptions, LLMCallResult } from './llm-call-wrapper.js'

export { logLLMCall, logDeepSeekChat } from './model-call-log.js'
export type { ModelCallLogContext } from './model-call-log.js'

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
} from './llm-model-catalog.js'
export type { ModelInfo } from './llm-model-catalog.js'
export type { TokenPricing } from '../core/cost-calculator.js'

export {
  DeepSeekProvider,
  DeepSeekAuthError,
  DeepSeekRateLimitError
} from './providers/deepseek-provider.js'
export {
  OpenAIProvider,
  OpenAIAuthError,
  OpenAIRateLimitError
} from './providers/openai-provider.js'
export {
  ArkLLMProvider,
  ArkLLMAuthError,
  ArkLLMRateLimitError
} from './providers/ark-llm-provider.js'
