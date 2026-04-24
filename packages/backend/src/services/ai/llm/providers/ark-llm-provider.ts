/**
 * 火山方舟 LLM Provider 实现
 * OpenAI 兼容接口
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
import { getArkLLMPricing } from '../llm-model-catalog.js'

export class ArkLLMAuthError extends Error {
  constructor(message = '火山方舟 API 认证失败，请检查 API Key') {
    super(message)
    this.name = 'ArkLLMAuthError'
  }
}

export class ArkLLMRateLimitError extends Error {
  constructor(message = '火山方舟 API 请求过于频繁，请稍后重试') {
    super(message)
    this.name = 'ArkLLMRateLimitError'
  }
}

export class ArkLLMProvider implements LLMProvider {
  readonly name = 'ark'
  readonly type = 'llm' as const

  private client: OpenAI
  private config: LLMProviderConfig

  constructor(config: LLMProviderConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://ark.cn-beijing.volces.com/api/v3'
    })
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletion> {
    const model = options?.model || this.config.defaultModel || 'doubao-pro-32k-241215'

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
        throw new Error('火山方舟 API 返回为空')
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
    const model = options?.model || this.config.defaultModel || 'doubao-pro-32k-241215'

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

  private calculateUsage(usage: unknown, model: string): LLMUsage {
    const typedUsage = usage as
      | {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        }
      | undefined

    const inputTokens = typedUsage?.prompt_tokens ?? 0
    const outputTokens = typedUsage?.completion_tokens ?? 0
    const totalTokens = typedUsage?.total_tokens ?? inputTokens + outputTokens

    const pricing = getArkLLMPricing(model)
    if (!pricing) {
      return { inputTokens, outputTokens, totalTokens, costCNY: 0 }
    }

    const result = calculateTokenCost(inputTokens, outputTokens, pricing)
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
      throw new ArkLLMAuthError()
    }
    if (errStatus === 429 || errMsg.includes('rate_limit')) {
      throw new ArkLLMRateLimitError()
    }
    throw error
  }
}
