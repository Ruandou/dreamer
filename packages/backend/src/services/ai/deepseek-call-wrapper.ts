/**
 * DeepSeek API 调用重试包装器
 * 封装通用的重试逻辑、错误处理和日志记录
 */

import type OpenAI from 'openai'
import {
  DeepSeekAuthError,
  DeepSeekRateLimitError,
  calculateDeepSeekCost,
  type DeepSeekCost
} from './deepseek-client.js'
import { logDeepSeekChat } from './model-call-log.js'
import type { ModelCallLogContext } from './api-logger.js'
import {
  DEFAULT_RETRY_ATTEMPTS,
  AUTH_RETRY_DELAY_MS,
  RETRY_BASE_DELAY_MS,
  AUTH_ERROR_STATUS_CODES,
  RATE_LIMIT_STATUS_CODE
} from './ai.constants.js'

export interface DeepSeekCallOptions {
  /** DeepSeek client 实例 */
  client: OpenAI
  /** 模型名称 */
  model?: string
  /** 系统提示词 */
  systemPrompt: string
  /** 用户提示词 */
  userPrompt: string
  /** 温度 */
  temperature?: number
  /** 最大 token */
  maxTokens?: number
  /** 模型调用日志上下文 */
  modelLog?: ModelCallLogContext
  /** 自定义重试次数 */
  maxRetries?: number
}

export interface DeepSeekCallResult<T> {
  /** 解析后的内容 */
  content: T
  /** API 调用成本 */
  cost: DeepSeekCost
  /** 原始响应 */
  rawResponse: OpenAI.Chat.ChatCompletion
}

/**
 * 通用的 DeepSeek API 调用函数，带重试和错误处理
 * @param options 调用选项
 * @param parser 解析函数，将 API 返回的字符串转换为所需类型
 */
export async function callDeepSeekWithRetry<T>(
  options: DeepSeekCallOptions,
  parser: (content: string) => T
): Promise<DeepSeekCallResult<T>> {
  const {
    client,
    model = 'deepseek-chat',
    systemPrompt,
    userPrompt,
    temperature = 0.7,
    maxTokens = 4000,
    modelLog,
    maxRetries = DEFAULT_RETRY_ATTEMPTS
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)
      const parsedContent = parser(content)

      await logDeepSeekChat(modelLog, userPrompt, {
        status: 'completed',
        costCNY: cost.costCNY
      })

      return {
        content: parsedContent,
        cost,
        rawResponse: completion
      }
    } catch (error: any) {
      lastError = error

      // 认证错误 - 立即抛出，不重试
      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        // Fire and forget - don't wait for logging
        logDeepSeekChat(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        }).catch(() => {
          /* ignore */
        })
        throw new DeepSeekAuthError()
      }

      // 限流错误 - 重试
      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < maxRetries) {
          await sleep(AUTH_RETRY_DELAY_MS * attempt)
          continue
        }
        // Fire and forget
        logDeepSeekChat(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit'
        }).catch(() => {
          /* ignore */
        })
        throw new DeepSeekRateLimitError()
      }

      // 其他错误 - 重试一次
      if (attempt < maxRetries) {
        await sleep(RETRY_BASE_DELAY_MS)
        continue
      }
    }
  }

  // 所有重试都失败了
  // Fire and forget
  logDeepSeekChat(modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || 'DeepSeek API 调用失败'
  }).catch(() => {
    /* ignore */
  })
  throw lastError || new Error('DeepSeek API 调用失败')
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
