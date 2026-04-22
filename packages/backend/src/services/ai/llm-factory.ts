/**
 * LLM Provider 注册与工厂
 * 使用 Registry 模式支持插件化的 Provider 扩展（OCP - Open/Closed Principle）
 *
 * 添加新 Provider 只需：
 * 1. 实现 LLMProvider 接口
 * 2. 调用 registerLLMProvider('name', factory)
 */

import type { LLMProvider } from './llm-provider.js'
import { DeepSeekProvider } from './deepseek-provider.js'
import { registerLLMProvider, createLLMProvider } from './llm-registry.js'

// Re-export LLMProvider types and registry functions
export type { LLMProvider } from './llm-provider.js'
export type { LLMProviderConfig } from './llm-provider.js'
export { registerLLMProvider, createLLMProvider } from './llm-registry.js'
export { llmRegistry, listLLMProviders, hasLLMProvider } from './llm-registry.js'

// 注册 DeepSeek provider（模块加载时自动执行）
registerLLMProvider('deepseek', (config) => new DeepSeekProvider(config))

// 未来添加新 provider 只需在这里注册：
// import { OpenAIProvider } from './openai-provider.js'
// registerLLMProvider('openai', (config) => new OpenAIProvider(config))

// import { ClaudeProvider } from './claude-provider.js'
// registerLLMProvider('claude', (config) => new ClaudeProvider(config))

/**
 * 获取默认的 LLM Provider（从环境变量读取配置）
 * @returns 默认 LLM Provider 实例
 */
export function getDefaultProvider(): LLMProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY environment variable is required. ' + 'Please set it in your .env file.'
    )
  }

  return createLLMProvider({
    provider: 'deepseek',
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat'
  })
}

/**
 * 创建指定类型的提供者（便捷方法）
 */
export const createDeepSeekProvider = (apiKey?: string, baseURL?: string): LLMProvider => {
  return createLLMProvider({
    provider: 'deepseek',
    apiKey: apiKey || process.env.DEEPSEEK_API_KEY || '',
    baseURL: baseURL || process.env.DEEPSEEK_BASE_URL,
    defaultModel: 'deepseek-chat'
  })
}
