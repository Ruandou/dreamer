/**
 * Search 模块统一导出
 */

export type {
  SearchProvider,
  WebSearchOptions,
  WebItem,
  WebSearchResult,
  WebSearchSummaryResult,
  ImageSearchItem,
  ImageSearchResult,
  SearchProviderFactory
} from './search-provider.js'

export {
  searchRegistry,
  registerSearchProvider,
  createSearchProvider,
  listSearchProviders,
  hasSearchProvider
} from './search-registry.js'

export { getDefaultSearchProvider, createVolcSearchProvider } from './search-factory.js'

export { VolcSearchProvider, VolcSearchError } from './providers/volc-search-provider.js'
