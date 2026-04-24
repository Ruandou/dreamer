/**
 * LLM Provider Factory
 * 注册所有 LLM Provider 并提供默认实例获取
 */

// getDefaultProviderFromCore available in provider-factory when needed
import {
  llmRegistry,
  registerLLMProvider,
  createLLMProvider,
  listLLMProviders,
  hasLLMProvider
} from './llm-registry.js'
import { DeepSeekProvider } from './providers/deepseek-provider.js'
import { OpenAIProvider } from './providers/openai-provider.js'
import { ArkLLMProvider } from './providers/ark-llm-provider.js'

export type { LLMProvider } from './llm-provider.js'
export type { LLMProviderConfig } from './llm-provider.js'
export { registerLLMProvider, createLLMProvider, llmRegistry, listLLMProviders, hasLLMProvider }

// 注册所有 LLM Provider
registerLLMProvider('deepseek', (config) => new DeepSeekProvider(config))
registerLLMProvider('openai', (config) => new OpenAIProvider(config))
registerLLMProvider('ark', (config) => new ArkLLMProvider(config))

/**
 * 获取默认 LLM Provider（从环境变量）
 * 兼容旧版 DEEPSEEK_API_KEY 配置
 */
export function getDefaultProvider() {
  return getDefaultProviderFromEnv()
}

function getDefaultProviderFromEnv() {
  const defaultProvider = process.env.LLM_DEFAULT_PROVIDER || 'deepseek'

  // 尝试新环境变量格式
  const apiKey = process.env[`${defaultProvider.toUpperCase()}_API_KEY`]
  if (apiKey) {
    return createLLMProvider({
      provider: defaultProvider,
      apiKey,
      baseURL: process.env[`${defaultProvider.toUpperCase()}_BASE_URL`] || undefined,
      defaultModel: process.env[`${defaultProvider.toUpperCase()}_DEFAULT_MODEL`] || undefined
    })
  }

  // 兼容旧版 DeepSeek 配置
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    return createLLMProvider({
      provider: 'deepseek',
      apiKey: deepseekKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      defaultModel: process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-v4-flash'
    })
  }

  throw new Error(
    'No LLM API key configured. Please set LLM_DEFAULT_PROVIDER and <PROVIDER>_API_KEY, ' +
      'or DEEPSEEK_API_KEY in your .env file.'
  )
}

/**
 * 创建指定类型的 LLM Provider（便捷方法）
 */
export function createDeepSeekProvider(apiKey?: string, baseURL?: string) {
  return createLLMProvider({
    provider: 'deepseek',
    apiKey: apiKey || process.env.DEEPSEEK_API_KEY || '',
    baseURL: baseURL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    defaultModel: process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-v4-flash'
  })
}

export function createOpenAIProvider(apiKey?: string, baseURL?: string) {
  return createLLMProvider({
    provider: 'openai',
    apiKey: apiKey || process.env.OPENAI_API_KEY || '',
    baseURL: baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o'
  })
}

export function createArkLLMProvider(apiKey?: string, baseURL?: string) {
  return createLLMProvider({
    provider: 'ark',
    apiKey: apiKey || process.env.ARK_LLM_API_KEY || process.env.ARK_API_KEY || '',
    baseURL:
      baseURL ||
      process.env.ARK_LLM_BASE_URL ||
      process.env.ARK_API_URL ||
      'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: process.env.ARK_LLM_DEFAULT_MODEL || 'doubao-pro-32k-241215'
  })
}
