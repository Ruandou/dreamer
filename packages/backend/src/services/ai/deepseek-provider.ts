/**
 * DeepSeek LLM 提供者实现
 * 实现 LLMProvider 接口，封装 DeepSeek API 调用
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
} from './llm-provider.js'
import {
  calculateDeepSeekCost,
  DeepSeekAuthError,
  DeepSeekRateLimitError
} from './deepseek-client.js'

export class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek'

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
    const model = options?.model || this.config.defaultModel || 'deepseek-chat'

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4000,
        ...(options?.extra || {})
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const usage = this.calculateUsage(completion.usage)

      return {
        content,
        usage,
        model,
        rawResponse: completion
      }
    } catch (error: unknown) {
      const errStatus = (error as { status?: number })?.status
      const errMsg = error instanceof Error ? error.message : ''
      // 转换为标准错误类型
      if (errStatus === 401 || errStatus === 403) {
        throw new DeepSeekAuthError()
      }
      if (errStatus === 429 || errMsg.includes('rate_limit')) {
        throw new DeepSeekRateLimitError()
      }
      throw error
    }
  }

  getConfig(): LLMProviderConfig {
    return { ...this.config }
  }

  async *stream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    const model = options?.model || this.config.defaultModel || 'deepseek-chat'

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4000,
        stream: true,
        ...(options?.extra || {})
      })

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        const finishReason = chunk.choices[0]?.finish_reason

        // 最后一个 chunk 包含 usage
        if (finishReason) {
          const usage = this.calculateUsage(chunk.usage)
          yield { delta, usage, done: true }
        } else {
          yield { delta, done: false }
        }
      }
    } catch (error: unknown) {
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

  private calculateUsage(usage: unknown): LLMUsage {
    const cost = calculateDeepSeekCost(usage)
    return {
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
      totalTokens: cost.totalTokens,
      costCNY: cost.costCNY
    }
  }
}
