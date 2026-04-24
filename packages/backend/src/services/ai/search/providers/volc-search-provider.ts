/**
 * 火山方舟 WebSearch Provider 实现
 * 支持 web / web_summary / image 三种搜索模式
 */

import type {
  SearchProvider,
  WebSearchOptions,
  WebSearchResult,
  WebSearchSummaryResult,
  ImageSearchResult,
  ImageSearchItem,
  WebItem
} from '../search-provider.js'
import type { ProviderConfig } from '../../core/provider-interface.js'
import { calculatePerCallCost } from '../../core/cost-calculator.js'

export class VolcSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VolcSearchError'
  }
}

export class VolcSearchProvider implements SearchProvider {
  readonly name = 'volc'
  readonly type = 'search' as const

  private config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  getConfig(): ProviderConfig {
    return { ...this.config }
  }

  async searchWeb(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult> {
    const res = await this.callSearchApi('web', query, options)
    const data = (await res.json()) as Record<string, unknown>

    if (!res.ok) {
      throw new VolcSearchError(`火山搜索 API 错误 ${res.status}: ${JSON.stringify(data)}`)
    }

    const items = this.parseWebItems(data)

    return {
      items,
      provider: this.name,
      model: 'web',
      cost: calculatePerCallCost(0), // 个人 500次/月免费
      rawResponse: data
    }
  }

  async searchWebSummary(
    query: string,
    options: WebSearchOptions = {}
  ): Promise<WebSearchSummaryResult> {
    const res = await this.callSearchApi('web_summary', query, options)
    const data = (await res.json()) as Record<string, unknown>

    if (!res.ok) {
      throw new VolcSearchError(`火山搜索 API 错误 ${res.status}: ${JSON.stringify(data)}`)
    }

    const items = this.parseWebItems(data)
    const summary = this.extractSummary(data)

    return {
      items,
      summary,
      provider: this.name,
      model: 'web_summary',
      cost: calculatePerCallCost(0),
      rawResponse: data
    }
  }

  async searchImages(query: string, options: WebSearchOptions = {}): Promise<ImageSearchResult> {
    const res = await this.callSearchApi('image', query, options)
    const data = (await res.json()) as Record<string, unknown>

    if (!res.ok) {
      throw new VolcSearchError(`火山搜索 API 错误 ${res.status}: ${JSON.stringify(data)}`)
    }

    const items = this.parseImageItems(data)

    return {
      items,
      provider: this.name,
      model: 'image',
      cost: calculatePerCallCost(0),
      rawResponse: data
    }
  }

  /**
   * web_summary 流式版本（SSE）
   */
  async *searchWebSummaryStream(
    query: string,
    options: WebSearchOptions = {}
  ): AsyncGenerator<{ type: 'search_result' | 'summary'; data: unknown }> {
    const res = await this.callSearchApi('web_summary', query, {
      ...options,
      stream: true
    })

    if (!res.ok || !res.body) {
      throw new VolcSearchError(`火山搜索流式 API 错误 ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const jsonStr = trimmed.slice(5).trim()
          if (jsonStr === '[DONE]') return

          try {
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>
            const choices = parsed.choices as Array<Record<string, unknown>> | undefined
            if (choices && choices[0]) {
              const delta = choices[0].delta as Record<string, unknown> | undefined
              if (delta?.content) {
                yield { type: 'summary', data: delta.content }
              }
            }
            // 搜索结果的引用
            if (parsed.search_results) {
              yield { type: 'search_result', data: parsed.search_results }
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ==================== 内部方法 ====================

  private async callSearchApi(
    endpoint: 'web' | 'web_summary' | 'image',
    query: string,
    options: WebSearchOptions & { stream?: boolean } = {}
  ): Promise<Response> {
    const body: Record<string, unknown> = {
      query,
      search_mode: endpoint
    }

    if (options.count !== undefined) body.count = options.count
    if (options.needContent !== undefined) body.need_content = options.needContent
    if (options.needUrl !== undefined) body.need_url = options.needUrl
    if (options.needSummary !== undefined) body.need_summary = options.needSummary
    if (options.timeRange) body.time_range = options.timeRange
    if (options.sites) body.sites = options.sites
    if (options.blockHosts) body.block_hosts = options.blockHosts
    if (options.authInfoLevel !== undefined) body.auth_info_level = options.authInfoLevel
    if (options.stream) body.stream = true

    return fetch(`${this.config.baseURL}/api/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    })
  }

  private parseWebItems(data: Record<string, unknown>): WebItem[] {
    const results = data.data as Record<string, unknown> | undefined
    if (!results) return []

    const items = results.items || results.search_results
    if (!Array.isArray(items)) return []

    return items.map((item: unknown) => {
      const i = item as Record<string, unknown>
      return {
        title: String(i.title || ''),
        url: String(i.url || i.link || ''),
        summary: i.summary ? String(i.summary) : undefined,
        content: i.content ? String(i.content) : undefined,
        site_name: i.site_name ? String(i.site_name) : undefined,
        publish_time: i.publish_time ? String(i.publish_time) : undefined,
        media: i.media ? String(i.media) : undefined,
        author: i.author ? String(i.author) : undefined,
        authority: typeof i.authority === 'number' ? i.authority : undefined
      }
    })
  }

  private parseImageItems(data: Record<string, unknown>): ImageSearchItem[] {
    const results = data.data as Record<string, unknown> | undefined
    if (!results) return []

    const items = results.items || results.image_results
    if (!Array.isArray(items)) return []

    return items.map((item: unknown) => {
      const i = item as Record<string, unknown>
      return {
        url: String(i.url || i.image_url || ''),
        width: typeof i.width === 'number' ? i.width : undefined,
        height: typeof i.height === 'number' ? i.height : undefined,
        title: i.title ? String(i.title) : undefined,
        source: i.source ? String(i.source) : undefined,
        hasWatermark: Boolean(i.has_watermark)
      }
    })
  }

  private extractSummary(data: Record<string, unknown>): string {
    const results = data.data as Record<string, unknown> | undefined
    if (!results) return ''

    // 尝试从 choices 中提取总结
    const choices = results.choices as Array<Record<string, unknown>> | undefined
    if (choices && choices[0]) {
      const message = choices[0].message as Record<string, unknown> | undefined
      if (message?.content) {
        return String(message.content)
      }
    }

    // 尝试直接取 summary
    if (results.summary) {
      return String(results.summary)
    }

    return ''
  }
}
