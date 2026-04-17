/**
 * LLM API 调用重试包装器
 * 使用 LLMProvider 抽象接口，支持多提供商
 * 封装通用的重试逻辑、错误处理和日志记录
 */

import type { LLMProvider, LLMMessage, LLMCompletion } from './llm-provider.js'
import type { DeepSeekCost } from './deepseek-client.js'
import { DeepSeekAuthError, DeepSeekRateLimitError } from './deepseek-client.js'
import { logDeepSeekChat } from './model-call-log.js'
import type { ModelCallLogContext } from './api-logger.js'
import {
  DEFAULT_RETRY_ATTEMPTS,
  AUTH_RETRY_DELAY_MS,
  RETRY_BASE_DELAY_MS,
  AUTH_ERROR_STATUS_CODES,
  RATE_LIMIT_STATUS_CODE
} from './ai.constants.js'

export interface LLMCallOptions {
  /** LLM 提供者实例 */
  provider: LLMProvider
  /** 消息数组 */
  messages: LLMMessage[]
  /** 温度 */
  temperature?: number
  /** 最大 token */
  maxTokens?: number
  /** 模型调用日志上下文 */
  modelLog?: ModelCallLogContext
  /** 自定义重试次数 */
  maxRetries?: number
  /** 模型名称（可选） */
  model?: string
}

export interface LLMCallResult<T> {
  /** 解析后的内容 */
  content: T
  /** API 调用成本 */
  cost: DeepSeekCost
  /** 原始响应 */
  rawResponse: unknown
}

/**
 * 通用的 LLM API 调用函数，带重试和错误处理
 * @param options 调用选项
 * @param parser 解析函数，将 API 返回的字符串转换为所需类型
 */
export async function callLLMWithRetry<T>(
  options: LLMCallOptions,
  parser: (content: string) => T
): Promise<LLMCallResult<T>> {
  const {
    provider,
    messages,
    temperature,
    maxTokens,
    modelLog,
    maxRetries = DEFAULT_RETRY_ATTEMPTS,
    model
  } = options

  let lastError: Error | null = null
  const userPrompt = messages.find((m) => m.role === 'user')?.content || ''

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await provider.complete(messages, {
        temperature,
        maxTokens,
        model
      })

      const parsedContent = parser(completion.content)

      await logDeepSeekChat(modelLog, userPrompt, {
        status: 'completed',
        costCNY: completion.usage.costCNY
      })

      return {
        content: parsedContent,
        cost: {
          inputTokens: completion.usage.inputTokens,
          outputTokens: completion.usage.outputTokens,
          totalTokens: completion.usage.totalTokens,
          costCNY: completion.usage.costCNY
        },
        rawResponse: completion.rawResponse
      }
    } catch (error: any) {
      lastError = error

      // 认证错误 - 立即抛出，不重试
      if (error instanceof DeepSeekAuthError || AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        logDeepSeekChat(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        }).catch(() => {
          /* ignore */
        })
        throw error instanceof DeepSeekAuthError ? error : new DeepSeekAuthError()
      }

      // 限流错误 - 重试
      if (
        error instanceof DeepSeekRateLimitError ||
        error?.status === RATE_LIMIT_STATUS_CODE ||
        error?.message?.includes('rate_limit')
      ) {
        if (attempt < maxRetries) {
          await sleep(AUTH_RETRY_DELAY_MS * attempt)
          continue
        }
        logDeepSeekChat(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit'
        }).catch(() => {
          /* ignore */
        })
        throw error instanceof DeepSeekRateLimitError ? error : new DeepSeekRateLimitError()
      }

      // 其他错误 - 重试一次
      if (attempt < maxRetries) {
        await sleep(RETRY_BASE_DELAY_MS)
        continue
      }
    }
  }

  // 所有重试都失败了
  logDeepSeekChat(modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || 'LLM API 调用失败'
  }).catch(() => {
    /* ignore */
  })
  throw lastError || new Error('LLM API 调用失败')
}

/**
 * 清理 Markdown 代码块标记
 */
export function cleanMarkdownCodeBlocks(content: string): string {
  if (content.includes('```json')) {
    return content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
  }
  if (content.includes('```')) {
    return content.replace(/```\n?/g, '').trim()
  }
  return content
}

/**
 * 解析 JSON 响应
 */
export function parseJsonResponse<T>(content: string, cleanMarkdown = true): T {
  let cleanContent = content
  if (cleanMarkdown) {
    cleanContent = cleanMarkdownCodeBlocks(content)
  }
  return JSON.parse(cleanContent) as T
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
