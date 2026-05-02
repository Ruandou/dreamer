/**
 * LLM API 调用重试包装器
 * 使用统一 CostResult，支持多提供商
 */

import type { LLMProvider, LLMMessage, LLMStreamChunk } from './llm-provider.js'
import type { CostResult } from '../core/provider-interface.js'
import { DeepSeekAuthError, DeepSeekRateLimitError } from './providers/deepseek-provider.js'
import { OpenAIAuthError, OpenAIRateLimitError } from './providers/openai-provider.js'
import { ArkLLMAuthError, ArkLLMRateLimitError } from './providers/ark-llm-provider.js'
import { withTimeout } from '../../../lib/with-timeout.js'
import { logLLMCall } from './model-call-log.js'
import type { ModelCallLogContext } from '../api-logger.js'
import {
  DEFAULT_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  AUTH_ERROR_STATUS_CODES,
  RATE_LIMIT_STATUS_CODE,
  API_CALL_TIMEOUT_MS
} from '../ai.constants.js'
import { logInfo, logWarning, logError } from '../../../lib/error-logger.js'

export interface LLMCallOptions {
  provider: LLMProvider
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
  modelLog?: ModelCallLogContext
  maxRetries?: number
  model?: string
  extra?: Record<string, unknown>
}

export interface LLMCallResult<T> {
  content: T
  cost: CostResult
  rawResponse: unknown
  model: string
  provider: string
}

/**
 * 通用的 LLM API 调用函数，带重试和错误处理
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
    model,
    extra
  } = options

  let lastError: Error | null = null
  const userPrompt = messages.find((m) => m.role === 'user')?.content || ''

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logInfo('LLM', `调用 LLM, attempt ${attempt}/${maxRetries}`, {
        op: modelLog?.op || 'unknown',
        provider: provider.name,
        model: model || provider.getConfig().defaultModel
      })

      const completion = await withTimeout(
        provider.complete(messages, {
          temperature,
          maxTokens,
          model,
          extra
        }),
        API_CALL_TIMEOUT_MS,
        `LLM API 调用超时 (${API_CALL_TIMEOUT_MS / 1000 / 60}分钟)`
      )

      const parsedContent = parser(completion.content)

      const cost: CostResult = {
        costCNY: completion.usage.costCNY,
        inputTokens: completion.usage.inputTokens,
        outputTokens: completion.usage.outputTokens,
        totalTokens: completion.usage.totalTokens
      }

      await logLLMCall(modelLog, userPrompt, {
        status: 'completed',
        cost,
        model: completion.model,
        provider: provider.name
      })

      return {
        content: parsedContent,
        cost,
        rawResponse: completion.rawResponse,
        model: completion.model,
        provider: provider.name
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : null
      const errStatus = (error as { status?: number })?.status

      if (isAuthError(error, errStatus)) {
        await logLLMCall(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: lastError?.message || 'auth',
          model: model || provider.getConfig().defaultModel,
          provider: provider.name
        }).catch(() => {})
        throw error
      }

      const errMsg = lastError?.message || ''
      if (isRateLimitError(error, errStatus, errMsg)) {
        if (attempt < maxRetries) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
          logWarning('LLM', `遇到限流, ${delay / 1000}秒后重试...`)
          await sleep(delay)
          continue
        }
        await logLLMCall(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit',
          model: model || provider.getConfig().defaultModel,
          provider: provider.name
        }).catch(() => {})
        throw error
      }

      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        logWarning('LLM', `其他错误 (${errStatus || errMsg}), ${delay / 1000}秒后重试...`)
        await sleep(delay)
        continue
      }
    }
  }

  logError('LLM', '所有重试失败', {
    op: modelLog?.op || 'unknown',
    error: lastError?.message,
    attempts: maxRetries
  })

  await logLLMCall(modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || 'LLM API 调用失败',
    model: model || provider.getConfig().defaultModel,
    provider: provider.name
  }).catch(() => {})

  throw lastError || new Error('LLM API 调用失败')
}

/**
 * 流式 LLM 调用函数，带重试和错误处理
 */
export async function* streamLLMWithRetry(
  options: LLMCallOptions
): AsyncGenerator<LLMStreamChunk & { accumulated: string }> {
  const {
    provider,
    messages,
    temperature,
    maxTokens,
    modelLog,
    maxRetries = DEFAULT_RETRY_ATTEMPTS,
    model,
    extra
  } = options

  let lastError: Error | null = null
  const userPrompt = messages.find((m) => m.role === 'user')?.content || ''

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logInfo('LLM', `流式调用 LLM, attempt ${attempt}/${maxRetries}`, {
        op: modelLog?.op || 'unknown',
        provider: provider.name
      })

      let accumulated = ''

      for await (const chunk of provider.stream(messages, {
        temperature,
        maxTokens,
        model,
        extra
      })) {
        accumulated += chunk.delta
        yield { ...chunk, accumulated }
      }

      await logLLMCall(modelLog, userPrompt, {
        status: 'completed',
        cost: { costCNY: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: model || provider.getConfig().defaultModel,
        provider: provider.name
      }).catch(() => {})

      return
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : null
      const errStatus = (error as { status?: number })?.status

      if (isAuthError(error, errStatus)) {
        await logLLMCall(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: lastError?.message || 'auth',
          model: model || provider.getConfig().defaultModel,
          provider: provider.name
        }).catch(() => {})
        throw error
      }

      const errMsg = lastError?.message || ''
      if (isRateLimitError(error, errStatus, errMsg)) {
        if (attempt < maxRetries) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
          logWarning('LLM', `流式遇到限流, ${delay / 1000}秒后重试...`)
          await sleep(delay)
          continue
        }
        await logLLMCall(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit',
          model: model || provider.getConfig().defaultModel,
          provider: provider.name
        }).catch(() => {})
        throw error
      }

      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        logWarning('LLM', `流式遇到其他错误 (${errStatus || errMsg}), ${delay / 1000}秒后重试...`)
        await sleep(delay)
        continue
      }
    }
  }

  logError('LLM', '流式所有重试失败', {
    op: modelLog?.op || 'unknown',
    error: lastError?.message,
    attempts: maxRetries
  })

  await logLLMCall(modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || 'LLM API 流式调用失败',
    model: model || provider.getConfig().defaultModel,
    provider: provider.name
  }).catch(() => {})

  throw lastError || new Error('LLM API 流式调用失败')
}

function isAuthError(error: unknown, errStatus?: number): boolean {
  return (
    error instanceof DeepSeekAuthError ||
    error instanceof OpenAIAuthError ||
    error instanceof ArkLLMAuthError ||
    (errStatus !== undefined && (AUTH_ERROR_STATUS_CODES as readonly number[]).includes(errStatus))
  )
}

function isRateLimitError(error: unknown, errStatus?: number, errMsg?: string): boolean {
  return (
    error instanceof DeepSeekRateLimitError ||
    error instanceof OpenAIRateLimitError ||
    error instanceof ArkLLMRateLimitError ||
    errStatus === RATE_LIMIT_STATUS_CODE ||
    (errMsg || '').includes('rate_limit')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ==================== 工具函数 ====================

/**
 * 收集流式 JSON 输出
 */
export async function collectStreamedJSON<T>(
  stream: AsyncGenerator<LLMStreamChunk & { accumulated: string }>,
  cleanMarkdown = true
): Promise<T> {
  let finalAccumulated = ''
  for await (const chunk of stream) {
    finalAccumulated = chunk.accumulated
  }
  return parseJsonResponse<T>(finalAccumulated, cleanMarkdown)
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
 * 尝试修复常见的 JSON 格式问题，包括截断处理
 */
function tryFixJson(json: string): string {
  let fixed = json.replace(/,\s*([}\]])/g, '$1')

  // 修复未闭合的字符串：逐行检查引号数量
  const lines = fixed.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const quotes = line.match(/"/g)
    if (quotes && quotes.length % 2 !== 0) {
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

  // 处理整体截断：找到最后一个完整的 JSON 结构边界
  const lastBrace = Math.max(fixed.lastIndexOf('}'), fixed.lastIndexOf(']'))
  if (lastBrace !== -1 && lastBrace < fixed.length - 1) {
    fixed = fixed.substring(0, lastBrace + 1)
  }

  // 如果 JSON 在字符串中被截断，尝试关闭未闭合的字符串和结构
  // 统计未闭合的引号（考虑转义）
  let inString = false
  let escapeNext = false
  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i]
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (ch === '\\') {
      escapeNext = true
      continue
    }
    if (ch === '"') {
      inString = !inString
    }
  }

  // 如果还在字符串中，关闭它并补全结构
  if (inString) {
    fixed = fixed + '"'
  }

  // 补全未闭合的对象/数组
  const openBraces = (fixed.match(/\{/g) || []).length
  const closeBraces = (fixed.match(/\}/g) || []).length
  const openBrackets = (fixed.match(/\[/g) || []).length
  const closeBrackets = (fixed.match(/\]/g) || []).length

  // 从末尾开始，补全缺少的闭合符号
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed = fixed + '}'
  }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed = fixed + ']'
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
  try {
    return JSON.parse(cleanContent) as T
  } catch (firstError) {
    logWarning('LLM', 'parseJsonResponse 直接解析失败，尝试修复 JSON...')
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
      throw firstError
    }
  }
}
