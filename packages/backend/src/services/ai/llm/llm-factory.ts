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
import { getModelInfo } from './llm-model-catalog.js'
import type { LLMProvider } from './llm-provider.js'
import { prisma } from '../../../lib/prisma.js'

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

/**
 * 根据模型 ID 获取对应的 Provider
 * 用于支持用户在创作时切换不同提供商的模型
 */
export function getProviderForModel(modelId?: string): LLMProvider {
  if (!modelId) {
    return getDefaultProvider()
  }

  const modelInfo = getModelInfo(modelId)
  if (!modelInfo) {
    console.warn(`[model-factory] 未知模型 ID "${modelId}"，使用默认 Provider`)
    return getDefaultProvider()
  }

  const providerName = modelInfo.provider

  // 尝试新环境变量格式
  const envKeyPrefix = providerName.toUpperCase()
  const apiKey = process.env[`${envKeyPrefix}_API_KEY`]

  if (apiKey) {
    return createLLMProvider({
      provider: providerName,
      apiKey,
      baseURL: process.env[`${envKeyPrefix}_BASE_URL`] || undefined,
      defaultModel: modelId
    })
  }

  // 兼容旧版环境变量（但保留用户选择的模型）
  if (providerName === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
    return createLLMProvider({
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      defaultModel: modelId
    })
  }
  if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
    return createLLMProvider({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      defaultModel: modelId
    })
  }
  if (providerName === 'ark' && (process.env.ARK_LLM_API_KEY || process.env.ARK_API_KEY)) {
    return createLLMProvider({
      provider: 'ark',
      apiKey: process.env.ARK_LLM_API_KEY || process.env.ARK_API_KEY || '',
      baseURL:
        process.env.ARK_LLM_BASE_URL ||
        process.env.ARK_API_URL ||
        'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: modelId
    })
  }

  return getDefaultProvider()
}

/**
 * 获取用户偏好的 LLM Provider
 * 从数据库读取用户的 modelPreferences，优先使用用户选择的文本模型
 * @param userId 用户 ID
 * @returns 对应模型的 Provider，若用户未设置则返回默认 Provider
 */
export async function getProviderForUser(userId: string): Promise<LLMProvider> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { modelPreferences: true }
    })

    const preferences = user?.modelPreferences as
      | { textModel?: string; imageModel?: string; videoModel?: string }
      | undefined
    if (preferences?.textModel) {
      return getProviderForModel(preferences.textModel)
    }
  } catch (e) {
    console.warn('[model-factory] 读取用户模型偏好失败，使用默认 Provider:', e)
  }

  return getDefaultProvider()
}
