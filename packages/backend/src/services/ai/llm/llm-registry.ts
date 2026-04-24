/**
 * LLM Provider Registry
 * 继承统一 ProviderRegistry，提供 LLM 专用便捷函数
 */

import { ProviderRegistry } from '../core/provider-registry.js'
import type { LLMProvider, LLMProviderConfig, LLMProviderFactory } from './llm-provider.js'

/** LLM 专用注册表 */
export const llmRegistry = new ProviderRegistry<LLMProvider>()

export function registerLLMProvider(name: string, factory: LLMProviderFactory): void {
  llmRegistry.register(name, factory)
}

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  return llmRegistry.create(config)
}

export function listLLMProviders(): string[] {
  return llmRegistry.listProviders()
}

export function hasLLMProvider(name: string): boolean {
  return llmRegistry.hasProvider(name)
}

export { llmRegistry as registry }
