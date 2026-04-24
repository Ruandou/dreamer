/**
 * @deprecated 已迁移到 llm/llm-factory.ts，请从该路径导入
 * 保留此文件以兼容现有调用方
 */

export type { LLMProvider, LLMProviderConfig } from './llm/llm-provider.js'
export {
  registerLLMProvider,
  createLLMProvider,
  llmRegistry,
  listLLMProviders,
  hasLLMProvider
} from './llm/llm-registry.js'
export {
  getDefaultProvider,
  createDeepSeekProvider,
  createOpenAIProvider,
  createArkLLMProvider
} from './llm/llm-factory.js'
