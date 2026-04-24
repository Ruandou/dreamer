/**
 * DeepSeek LLM Provider 实现
 * 支持 V4 Flash / V4 Pro，含缓存命中/未命中定价
 */

import OpenAI from 'openai'
import type {
  LLMProvider,
  LLMProviderConfig,
  LLMMessage,
  LLMCompletion,
  LLMCompletionOptions,
  LLMUsage,
  LLMStreamChunk
} from '../llm-provider.js'
import { calculateTokenCost } from '../../core/cost-calculator.js'
import { resolveDeepSeekModel, getDeepSeekPricing } from '../llm-model-catalog.js'

export class DeepSeekAuthError extends Error {
  constructor(message = 'DeepSeek API 认证失败，请检查 API Key') {
    super(message)
    this.name = 'DeepSeekAuthError'
  }
}

export class DeepSeekRateLimitError extends Error {
  constructor(message = 'DeepSeek API 请求过于频繁，请稍后重试') {
    super(message)
    this.name = 'DeepSeekRateLimitError'
  }
}

export class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek'
  readonly type = 'llm' as const

  private client: OpenAI
  private config: LLMProviderConfig

  constructor(config: LLMProviderConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.deepseek.com/v1'
    })
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletion> {
    const model = this.resolveModel(options?.model)

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4000,
        ...(options?.extra || {})
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const usage = this.calculateUsage(completion.usage, model)

      return {
        content,
        usage,
        model,
        rawResponse: completion
      }
    } catch (error: unknown) {
      this.handleError(error)
    }
  }

  async *stream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    const model = this.resolveModel(options?.model)

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4000,
        stream: true,
        ...(options?.extra || {})
      })

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        const finishReason = chunk.choices[0]?.finish_reason

        if (finishReason) {
          const usage = this.calculateUsage(chunk.usage, model)
          yield { delta, usage, done: true }
        } else {
          yield { delta, done: false }
        }
      }
    } catch (error: unknown) {
      this.handleError(error)
    }
  }

  getConfig(): LLMProviderConfig {
    return { ...this.config }
  }

  private resolveModel(model?: string): string {
    const raw = model || this.config.defaultModel || 'deepseek-v4-flash'
    return resolveDeepSeekModel(raw)
  }

  private calculateUsage(usage: unknown, model: string): LLMUsage {
    const typedUsage = usage as
      | {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          prompt_cache_hit_tokens?: number
          prompt_cache_miss_tokens?: number
        }
      | undefined

    const inputTokens = typedUsage?.prompt_tokens ?? 0
    const outputTokens = typedUsage?.completion_tokens ?? 0
    const totalTokens = typedUsage?.total_tokens ?? inputTokens + outputTokens

    // 判断缓存状态：如果有 cache hit tokens，则按实际比例计算
    const cacheHitTokens = typedUsage?.prompt_cache_hit_tokens ?? 0
    const cacheMissTokens = typedUsage?.prompt_cache_miss_tokens ?? 0
    const hasCacheInfo = cacheHitTokens > 0 || cacheMissTokens > 0
    const cacheHit = hasCacheInfo ? cacheMissTokens === 0 : false

    const pricing = getDeepSeekPricing(model)
    if (!pricing) {
      return { inputTokens, outputTokens, totalTokens, costCNY: 0 }
    }

    // 如果有缓存明细，精确计算
    if (
      hasCacheInfo &&
      pricing.inputCacheHitCostPer1M !== undefined &&
      pricing.inputCacheMissCostPer1M !== undefined
    ) {
      const hitCost = (cacheHitTokens / 1_000_000) * pricing.inputCacheHitCostPer1M
      const missCost = (cacheMissTokens / 1_000_000) * pricing.inputCacheMissCostPer1M
      const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPer1M
      const costCNY = Math.round((hitCost + missCost + outputCost) * 1_000_000) / 1_000_000
      return { inputTokens, outputTokens, totalTokens, costCNY }
    }

    // 否则使用统一计算
    const result = calculateTokenCost(inputTokens, outputTokens, pricing, cacheHit)
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      costCNY: result.costCNY
    }
  }

  private handleError(error: unknown): never {
    const errStatus = (error as { status?: number })?.status
    const errMsg = error instanceof Error ? error.message : ''
    if (errStatus === 401 || errStatus === 403) {
      throw new DeepSeekAuthError()
    }
    if (errStatus === 429 || errMsg.includes('rate_limit')) {
      throw new DeepSeekRateLimitError()
    }
    throw error
  }
}
