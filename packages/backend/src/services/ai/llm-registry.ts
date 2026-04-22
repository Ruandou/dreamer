/**
 * LLM Provider Registry
 * 支持插件化的 LLM Provider 注册与创建（OCP - Open/Closed Principle）
 *
 * 使用示例：
 * ```typescript
 * // 注册新 provider
 * registerLLMProvider('openai', (config) => new OpenAIProvider(config))
 *
 * // 创建 provider（自动从 registry 查找）
 * const provider = createLLMProvider({ provider: 'openai', apiKey: '...' })
 * ```
 */

import type { LLMProvider, LLMProviderConfig, LLMProviderFactory } from './llm-provider.js'

/**
 * LLM Provider 注册表
 * 维护 provider 名称到工厂函数的映射
 */
class LLMProviderRegistry {
  private providers = new Map<string, LLMProviderFactory>()

  /**
   * 注册一个新的 LLM Provider
   * @param name Provider 名称（不区分大小写）
   * @param factory 工厂函数，接收配置返回 Provider 实例
   */
  register(name: string, factory: LLMProviderFactory): void {
    this.providers.set(name.toLowerCase(), factory)
  }

  /**
   * 创建 LLM Provider 实例
   * @param config Provider 配置
   * @returns LLM Provider 实例
   * @throws Error 如果 provider 未注册
   */
  create(config: LLMProviderConfig): LLMProvider {
    const factory = this.providers.get(config.provider.toLowerCase())
    if (!factory) {
      const available = this.listProviders().join(', ')
      throw new Error(`Unknown LLM provider: ${config.provider}. Available providers: ${available}`)
    }
    return factory(config)
  }

  /**
   * 检查是否已注册某个 provider
   * @param name Provider 名称
   * @returns 是否已注册
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name.toLowerCase())
  }

  /**
   * 列出所有已注册的 provider 名称
   * @returns provider 名称列表
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * 获取已注册的 provider 数量
   */
  get size(): number {
    return this.providers.size
  }
}

// 创建全局单例
export const llmRegistry = new LLMProviderRegistry()

/**
 * 注册 LLM Provider 的便捷函数
 * @param name Provider 名称
 * @param factory 工厂函数
 */
export function registerLLMProvider(name: string, factory: LLMProviderFactory): void {
  llmRegistry.register(name, factory)
}

/**
 * 创建 LLM Provider 实例（从 registry 查找）
 * @param config Provider 配置
 * @returns LLM Provider 实例
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  return llmRegistry.create(config)
}

/**
 * 列出所有已注册的 provider
 * @returns provider 名称列表
 */
export function listLLMProviders(): string[] {
  return llmRegistry.listProviders()
}

/**
 * 检查 provider 是否已注册
 * @param name Provider 名称
 * @returns 是否已注册
 */
export function hasLLMProvider(name: string): boolean {
  return llmRegistry.hasProvider(name)
}
