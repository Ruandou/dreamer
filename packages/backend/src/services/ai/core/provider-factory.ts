/**
 * 统一 Provider Factory
 * 从环境变量创建 Provider 实例的通用逻辑
 */

import type { BaseProvider, ProviderConfig } from './provider-interface.js'
import { ProviderRegistry } from './provider-registry.js'

/**
 * 创建 Provider 实例（从 Registry 查找）
 */
export function createProvider<T extends BaseProvider>(
  registry: ProviderRegistry<T>,
  config: ProviderConfig
): T {
  return registry.create(config)
}

/**
 * 从环境变量读取配置并创建 Provider
 * @param registry Provider 注册表
 * @param envPrefix 环境变量前缀（如 'DEEPSEEK', 'ARK_IMAGE'）
 * @param defaultProvider 默认 Provider 名称
 * @returns Provider 实例
 */
export function createProviderFromEnv<T extends BaseProvider>(
  registry: ProviderRegistry<T>,
  envPrefix: string,
  defaultProvider: string
): T {
  const providerName = process.env[`${envPrefix}_DEFAULT_PROVIDER`] || defaultProvider
  const apiKey = process.env[`${envPrefix}_API_KEY`] || ''
  const baseURL = process.env[`${envPrefix}_BASE_URL`] || undefined
  const defaultModel = process.env[`${envPrefix}_DEFAULT_MODEL`] || undefined

  if (!apiKey) {
    throw new Error(
      `${envPrefix}_API_KEY environment variable is required. ` + `Please set it in your .env file.`
    )
  }

  return registry.create({
    provider: providerName,
    apiKey,
    baseURL,
    defaultModel
  })
}

/**
 * 获取默认 Provider（通用逻辑，支持回退）
 * 尝试从环境变量读取，失败时抛出错误
 */
export function getDefaultProvider<T extends BaseProvider>(
  registry: ProviderRegistry<T>,
  envPrefix: string,
  defaultProvider: string,
  fallbackEnvKey?: string
): T {
  // 尝试主环境变量
  const primaryApiKey = process.env[`${envPrefix}_API_KEY`]
  if (primaryApiKey) {
    return createProviderFromEnv(registry, envPrefix, defaultProvider)
  }

  // 尝试回退环境变量（兼容旧配置）
  if (fallbackEnvKey) {
    const fallbackApiKey = process.env[fallbackEnvKey]
    if (fallbackApiKey) {
      const baseURL = process.env[`${fallbackEnvKey.replace('_API_KEY', '_BASE_URL')}`] || undefined
      return registry.create({
        provider: defaultProvider,
        apiKey: fallbackApiKey,
        baseURL,
        defaultModel: process.env[`${envPrefix}_DEFAULT_MODEL`] || undefined
      })
    }
  }

  throw new Error(
    `No API key found for ${envPrefix}. ` + `Please set ${envPrefix}_API_KEY in your .env file.`
  )
}
