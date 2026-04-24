/**
 * Search Provider Registry
 */

import { ProviderRegistry } from '../core/provider-registry.js'
import type { SearchProvider, ProviderConfig } from './search-provider.js'

export const searchRegistry = new ProviderRegistry<SearchProvider>()

export function registerSearchProvider(
  name: string,
  factory: (config: ProviderConfig) => SearchProvider
): void {
  searchRegistry.register(name, factory)
}

export function createSearchProvider(config: ProviderConfig): SearchProvider {
  return searchRegistry.create(config)
}

export function listSearchProviders(): string[] {
  return searchRegistry.listProviders()
}

export function hasSearchProvider(name: string): boolean {
  return searchRegistry.hasProvider(name)
}
