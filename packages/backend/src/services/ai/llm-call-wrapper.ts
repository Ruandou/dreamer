/**
 * LLM API 调用重试包装器
 * 使用 LLMProvider 抽象接口，支持多提供商
 * 封装通用的重试逻辑、错误处理和日志记录
 */

import type { LLMProvider, LLMMessage } from './llm-provider.js'
import type { DeepSeekCost } from './deepseek-client.js'
import { DeepSeekAuthError, DeepSeekRateLimitError } from './deepseek-client.js'
import { withTimeout } from '../../lib/with-timeout.js'
import { logDeepSeekChat } from './model-call-log.js'
import type { ModelCallLogContext } from './api-logger.js'
import {
  DEFAULT_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  AUTH_ERROR_STATUS_CODES,
  RATE_LIMIT_STATUS_CODE,
  API_CALL_TIMEOUT_MS
} from './ai.constants.js'
import { logInfo, logWarning, logError } from '../../lib/error-logger.js'

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
      logInfo('LLM', `调用 LLM, attempt ${attempt}/${maxRetries}`, {
        op: modelLog?.op || 'unknown'
      })

      const completion = await withTimeout(
        provider.complete(messages, {
          temperature,
          maxTokens,
          model
        }),
        API_CALL_TIMEOUT_MS,
        `LLM API 调用超时 (${API_CALL_TIMEOUT_MS / 1000 / 60}分钟)`
      )

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
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : null

      // 认证错误 - 立即抛出，不重试
      const errStatus = (error as { status?: number })?.status
      if (
        error instanceof DeepSeekAuthError ||
        (errStatus !== undefined &&
          (AUTH_ERROR_STATUS_CODES as readonly number[]).includes(errStatus))
      ) {
        logDeepSeekChat(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: lastError?.message || 'auth'
        }).catch(() => {
          /* ignore */
        })
        throw error instanceof DeepSeekAuthError ? error : new DeepSeekAuthError()
      }

      // 限流错误 - 使用指数退避重试
      const errMsg = lastError?.message || ''
      if (
        error instanceof DeepSeekRateLimitError ||
        errStatus === RATE_LIMIT_STATUS_CODE ||
        errMsg.includes('rate_limit')
      ) {
        if (attempt < maxRetries) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) // 指数退避：1s, 2s, 4s
          logWarning('LLM', `遇到限流, ${delay / 1000}秒后重试...`)
          await sleep(delay)
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

      // 其他错误 - 使用指数退避重试
      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) // 指数退避：1s, 2s, 4s
        logWarning('LLM', `其他错误 (${errStatus || errMsg}), ${delay / 1000}秒后重试...`)
        await sleep(delay)
        continue
      }
    }
  }

  // 所有重试都失败了
  logError('LLM', '所有重试失败', {
    op: modelLog?.op || 'unknown',
    error: lastError?.message,
    attempts: maxRetries
  })

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
    logWarning('LLM', 'parseJsonResponse 直接解析失败，尝试修复 JSON...')

    // 尝试修复
    const fixed = tryFixJson(cleanContent)
    try {
      const result = JSON.parse(fixed) as T
      logInfo('LLM', 'parseJsonResponse JSON 修复成功')
      return result
    } catch (secondError) {
      logError('LLM', 'parseJsonResponse JSON 修复失败', {
        originalError: firstError instanceof Error ? firstError.message : String(firstError),
        fixedError: secondError instanceof Error ? secondError.message : String(secondError),
        contentPreview: cleanContent.substring(0, 500)
      })
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
