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
  RATE_LIMIT_STATUS_CODE,
  API_CALL_TIMEOUT_MS
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
      console.log(
        `[deepseek-call] 调用 ${model}, attempt ${attempt}/${maxRetries}, op=${modelLog?.op || 'unknown'}`
      )

      // 添加超时保护
      const completion = await Promise.race([
        client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`API 调用超时 (${API_CALL_TIMEOUT_MS / 1000}秒)`)),
            API_CALL_TIMEOUT_MS
          )
        )
      ])

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      console.log(`[deepseek-call] API 调用成功, 内容长度: ${content.length} chars`)

      const cost = calculateDeepSeekCost(completion.usage)

      // 增强parser错误处理
      let parsedContent: T
      try {
        parsedContent = parser(content)
        console.log(`[deepseek-call] Parser 解析成功, op=${modelLog?.op || 'unknown'}`)
      } catch (parseError: any) {
        console.error(`[deepseek-call] Parser 解析失败, op=${modelLog?.op || 'unknown'}`, {
          error: parseError.message,
          contentLength: content.length,
          contentPreview: content.substring(0, 500)
        })
        throw new Error(`内容解析失败: ${parseError.message}`, { cause: parseError })
      }

      // 记录完整日志 - 包含system prompt和完整响应
      await logDeepSeekChat(
        modelLog,
        userPrompt,
        {
          status: 'completed',
          costCNY: cost.costCNY,
          rawContent: content // 完整输出内容
        },
        {
          systemMessage: systemPrompt, // 完整system prompt
          responseMetadata: {
            model: completion.model,
            usage: completion.usage,
            finishReason: completion.choices[0]?.finish_reason,
            contentLength: content.length
          }
        }
      )

      return {
        content: parsedContent,
        cost,
        rawResponse: completion
      }
    } catch (error: any) {
      lastError = error

      console.error(
        `[deepseek-call] 调用失败, attempt ${attempt}/${maxRetries}, op=${modelLog?.op || 'unknown'}`,
        {
          error: error.message,
          status: error?.status,
          type: error?.constructor?.name
        }
      )

      // 认证错误 - 立即抛出，不重试
      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        // Fire and forget - don't wait for logging
        logDeepSeekChat(
          modelLog,
          userPrompt,
          {
            status: 'failed',
            errorMsg: error?.message || 'auth',
            rawContent: undefined
          },
          {
            systemMessage: systemPrompt,
            responseMetadata: {
              errorStatus: error?.status,
              errorType: error?.constructor?.name,
              attempt
            }
          }
        ).catch(() => {
          /* ignore */
        })
        throw new DeepSeekAuthError()
      }

      // 限流错误 - 重试
      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < maxRetries) {
          const delay = AUTH_RETRY_DELAY_MS * attempt
          console.log(`[deepseek-call] 遇到限流, ${delay}ms 后重试...`)
          await sleep(delay)
          continue
        }
        // Fire and forget
        logDeepSeekChat(
          modelLog,
          userPrompt,
          {
            status: 'failed',
            errorMsg: 'rate_limit',
            rawContent: undefined
          },
          {
            systemMessage: systemPrompt,
            responseMetadata: {
              errorStatus: error?.status,
              errorType: error?.constructor?.name,
              attempts: attempt
            }
          }
        ).catch(() => {
          /* ignore */
        })
        throw new DeepSeekRateLimitError()
      }

      // 其他错误 - 重试一次
      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * attempt
        console.log(`[deepseek-call] 其他错误, ${delay}ms 后重试...`)
        await sleep(delay)
        continue
      }
    }
  }

  // 所有重试都失败了
  console.error(`[deepseek-call] 所有重试失败, op=${modelLog?.op || 'unknown'}`, {
    error: lastError?.message,
    attempts: maxRetries
  })

  // Fire and forget - 记录完整错误信息
  const lastErrorAny = lastError as any
  logDeepSeekChat(
    modelLog,
    userPrompt,
    {
      status: 'failed',
      errorMsg: lastError?.message || 'DeepSeek API 调用失败',
      rawContent: undefined
    },
    {
      systemMessage: systemPrompt,
      responseMetadata: {
        error: lastError?.message,
        errorStack: lastError?.stack,
        errorType: lastError?.constructor?.name,
        errorStatus: lastErrorAny?.status,
        attempts: maxRetries
      }
    }
  ).catch(() => {
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
