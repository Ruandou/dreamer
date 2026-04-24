/**
 * 统一 Provider Registry（泛型实现）
 * 所有 AI 服务共享同一套注册表模式
 */

import type { BaseProvider, ProviderConfig, ProviderFactory } from './provider-interface.js'

/**
 * Provider 注册表
 * 维护 provider 名称到工厂函数的映射
 */
export class ProviderRegistry<T extends BaseProvider> {
  private providers = new Map<string, ProviderFactory<T>>()

  /**
   * 注册一个新的 Provider
   * @param name Provider 名称（不区分大小写）
   * @param factory 工厂函数，接收配置返回 Provider 实例
   */
  register(name: string, factory: ProviderFactory<T>): void {
    this.providers.set(name.toLowerCase(), factory)
  }

  /**
   * 创建 Provider 实例
   * @param config Provider 配置
   * @returns Provider 实例
   * @throws Error 如果 provider 未注册
   */
  create(config: ProviderConfig): T {
    const factory = this.providers.get(config.provider.toLowerCase())
    if (!factory) {
      const available = this.listProviders().join(', ')
      throw new Error(`Unknown provider: ${config.provider}. Available providers: ${available}`)
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
