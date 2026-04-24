/**
 * Search Provider Factory
 */

import {
  searchRegistry,
  registerSearchProvider,
  createSearchProvider,
  listSearchProviders,
  hasSearchProvider
} from './search-registry.js'
import { VolcSearchProvider } from './providers/volc-search-provider.js'

export type { SearchProvider } from './search-provider.js'
export {
  registerSearchProvider,
  createSearchProvider,
  searchRegistry,
  listSearchProviders,
  hasSearchProvider
}

// 注册 Search Provider
registerSearchProvider('volc', (config) => new VolcSearchProvider(config))

/**
 * 获取默认 Search Provider
 */
export function getDefaultSearchProvider() {
  const defaultProvider = process.env.SEARCH_DEFAULT_PROVIDER || 'volc'
  const apiKey = process.env.VOLC_SEARCH_API_KEY

  if (!apiKey) {
    throw new Error(
      'No Search API key configured. Please set VOLC_SEARCH_API_KEY in your .env file.'
    )
  }

  return createSearchProvider({
    provider: defaultProvider,
    apiKey,
    baseURL: process.env.VOLC_SEARCH_BASE_URL || 'https://open.feedcoopapi.com'
  })
}

export function createVolcSearchProvider(apiKey?: string, baseURL?: string) {
  return createSearchProvider({
    provider: 'volc',
    apiKey: apiKey || process.env.VOLC_SEARCH_API_KEY || '',
    baseURL: baseURL || process.env.VOLC_SEARCH_BASE_URL || 'https://open.feedcoopapi.com'
  })
}
