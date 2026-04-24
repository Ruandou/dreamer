/**
 * LLM Provider 接口（继承统一 core 接口）
 */

import type { BaseProvider, ProviderConfig } from '../core/provider-interface.js'

export type LLMRole = 'system' | 'user' | 'assistant'

export interface LLMMessage {
  role: LLMRole
  content: string
}

export interface LLMUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCNY: number
}

export interface LLMCompletion {
  content: string
  usage: LLMUsage
  model: string
  rawResponse: unknown
}

export interface LLMCompletionOptions {
  temperature?: number
  maxTokens?: number
  model?: string
  topP?: number
  extra?: Record<string, unknown>
}

export interface LLMStreamChunk {
  delta: string
  usage?: LLMUsage
  done: boolean
}

/** LLM 专用 Provider 接口 */
export interface LLMProvider extends BaseProvider {
  readonly type: 'llm'
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMCompletion>
  stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncIterable<LLMStreamChunk>
}

/** LLM Provider 配置（兼容旧接口） */
export interface LLMProviderConfig extends ProviderConfig {
  provider: 'deepseek' | 'openai' | 'claude' | 'qwen' | 'ark' | string
}

export type LLMProviderFactory = (config: LLMProviderConfig) => LLMProvider
