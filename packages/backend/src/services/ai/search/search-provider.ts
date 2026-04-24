/**
 * Search Provider 接口
 * 联网搜索统一抽象
 */

import type { BaseProvider, ProviderConfig, ApiCallResult } from '../core/provider-interface.js'

export type { ProviderConfig }

export interface WebSearchOptions {
  count?: number
  needContent?: boolean
  needUrl?: boolean
  needSummary?: boolean
  timeRange?: 'OneDay' | 'OneWeek' | 'OneMonth' | 'OneYear' | string
  sites?: string[]
  blockHosts?: string[]
  authInfoLevel?: 0 | 1
}

export interface WebItem {
  title: string
  url: string
  summary?: string
  content?: string
  site_name?: string
  publish_time?: string
  media?: string
  author?: string
  authority?: number
}

export interface WebSearchResult extends ApiCallResult {
  items: WebItem[]
}

export interface WebSearchSummaryResult extends ApiCallResult {
  items: WebItem[]
  summary: string
}

export interface ImageSearchItem {
  url: string
  width?: number
  height?: number
  title?: string
  source?: string
  hasWatermark?: boolean
}

export interface ImageSearchResult extends ApiCallResult {
  items: ImageSearchItem[]
}

/** Search Provider 接口 */
export interface SearchProvider extends BaseProvider {
  readonly type: 'search'
  searchWeb(query: string, options?: WebSearchOptions): Promise<WebSearchResult>
  searchWebSummary(query: string, options?: WebSearchOptions): Promise<WebSearchSummaryResult>
  searchImages(query: string, options?: WebSearchOptions): Promise<ImageSearchResult>
}

export type SearchProviderFactory = (config: ProviderConfig) => SearchProvider
