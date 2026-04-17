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
 * 尝试修复常见的 JSON 格式问题
 */
function tryFixJson(json: string): string {
  let fixed = json

  // 移除尾部逗号（数组或对象最后一个元素后的逗号）
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')

  // 修复未闭合的字符串（在行尾添加引号）
  const lines = fixed.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 检查是否有未闭合的字符串
    const quotes = line.match(/"/g)
    if (quotes && quotes.length % 2 !== 0) {
      // 找到最后一个冒号后的位置，添加闭合引号
      const lastColonIndex = line.lastIndexOf(':')
      if (lastColonIndex !== -1) {
        const afterColon = line.substring(lastColonIndex + 1).trim()
        if (afterColon.startsWith('"') && !afterColon.endsWith('"')) {
          lines[i] = line + '"'
        }
      }
    }
  }
  fixed = lines.join('\n')

  // 尝试找到最后一个完整的对象/数组结束位置
  const lastBrace = Math.max(fixed.lastIndexOf('}'), fixed.lastIndexOf(']'))
  if (lastBrace !== -1 && lastBrace < fixed.length - 1) {
    // 截断到最后一个完整的结构
    fixed = fixed.substring(0, lastBrace + 1)
  }

  return fixed
}

/**
 * 解析 JSON 响应，带自动修复功能
 */
export function parseJsonResponse<T>(content: string, cleanMarkdown = true): T {
  let cleanContent = content
  if (cleanMarkdown) {
    cleanContent = cleanMarkdownCodeBlocks(content)
  }

  // 首先尝试直接解析
  try {
    return JSON.parse(cleanContent) as T
  } catch (firstError) {
    console.warn('[parseJsonResponse] 直接解析失败，尝试修复 JSON...')

    // 尝试修复
    const fixed = tryFixJson(cleanContent)
    try {
      const result = JSON.parse(fixed) as T
      console.log('[parseJsonResponse] JSON 修复成功')
      return result
    } catch (secondError) {
      console.error('[parseJsonResponse] JSON 修复失败')
      console.error('[parseJsonResponse] 原始错误:', firstError)
      console.error('[parseJsonResponse] 修复后错误:', secondError)
      console.error('[parseJsonResponse] 内容前 500 字符:', cleanContent.substring(0, 500))
      throw firstError // 抛出原始错误
    }
  }
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
