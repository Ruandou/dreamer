/**
 * @deprecated 已迁移到 llm/llm-provider.ts，请从该路径导入
 * 保留此文件以兼容现有调用方
 */

export type {
  LLMRole,
  LLMMessage,
  LLMUsage,
  LLMCompletion,
  LLMProviderConfig,
  LLMCompletionOptions,
  LLMStreamChunk,
  LLMProvider,
  LLMProviderFactory
} from './llm/llm-provider.js'
