/**
 * LLM 提供者工厂
 * 根据配置创建对应的 Provider 实例
 */

import type { LLMProvider, LLMProviderConfig } from './llm-provider.js'
import { DeepSeekProvider } from './deepseek-provider.js'

// Re-export LLMProvider types for convenience
export type { LLMProvider, LLMProviderConfig } from './llm-provider.js'

/**
 * 创建 LLM 提供者实例
 * @param config 提供者配置
 * @returns LLM 提供者实例
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider.toLowerCase()) {
    case 'deepseek':
      return new DeepSeekProvider(config)

    case 'openai':
      // TODO: 实现 OpenAI Provider
      // return new OpenAIProvider(config)
      throw new Error('OpenAI provider not yet implemented')

    case 'claude':
      // TODO: 实现 Claude Provider
      // return new ClaudeProvider(config)
      throw new Error('Claude provider not yet implemented')

    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`)
  }
}

/**
 * 获取默认的 LLM 提供者（从环境变量读取配置）
 * @returns 默认 LLM 提供者实例
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
