/**
 * @deprecated 已迁移到 llm/llm-registry.ts，请从该路径导入
 * 保留此文件以兼容现有调用方
 */

export {
  llmRegistry,
  registerLLMProvider,
  createLLMProvider,
  listLLMProviders,
  hasLLMProvider
} from './llm/llm-registry.js'
