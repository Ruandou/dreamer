/**
 * OpenAI LLM Provider 实现
 * 支持 GPT-4o / GPT-4o-mini / DALL-E 等
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
import { getOpenAIPricing } from '../llm-model-catalog.js'

export class OpenAIAuthError extends Error {
  constructor(message = 'OpenAI API 认证失败，请检查 API Key') {
    super(message)
    this.name = 'OpenAIAuthError'
  }
}

export class OpenAIRateLimitError extends Error {
  constructor(message = 'OpenAI API 请求过于频繁，请稍后重试') {
    super(message)
    this.name = 'OpenAIRateLimitError'
  }
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai'
  readonly type = 'llm' as const

  private client: OpenAI
  private config: LLMProviderConfig

  constructor(config: LLMProviderConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.openai.com/v1'
    })
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletion> {
    const model = options?.model || this.config.defaultModel || 'gpt-4o'

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
        throw new Error('OpenAI API 返回为空')
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
    const model = options?.model || this.config.defaultModel || 'gpt-4o'

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

    const pricing = getOpenAIPricing(model)
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
      throw new OpenAIAuthError()
    }
    if (errStatus === 429 || errMsg.includes('rate_limit')) {
      throw new OpenAIRateLimitError()
    }
    throw error
  }
}
