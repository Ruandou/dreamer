/**
 * 统一 LLM 调用日志
 * 替代旧的 logDeepSeekChat，支持任意 Provider / 模型
 */

import {
  recordModelApiCall,
  truncateForModelLog,
  MODEL_LOG_RESPONSE_MAX,
  type ModelCallLogContext
} from '../api-logger.js'
import type { CostResult } from '../core/provider-interface.js'
import { logWarning } from '../../../lib/error-logger.js'

export type { ModelCallLogContext }

export interface LogLLMCallOptions {
  systemMessage?: string
  rawResponse?: string
  responseMetadata?: Record<string, unknown>
}

export interface LogLLMCallResult {
  status: 'completed' | 'failed'
  cost?: CostResult
  errorMsg?: string
  model?: string
  provider?: string
}

/**
 * 统一 LLM 调用日志记录
 * 替代 logDeepSeekChat，支持多 Provider / 多模型
 */
export async function logLLMCall(
  log: ModelCallLogContext | undefined,
  userMessage: string,
  result: LogLLMCallResult,
  options?: LogLLMCallOptions
): Promise<void> {
  if (!log) {
    logWarning(
      'ModelAPI',
      'LLM 调用未写入 ModelApiCall：缺少 ModelCallLogContext。请检查调用方是否传入 userId + op。'
    )
    return
  }

  const sys = options?.systemMessage?.trim()
  const promptForLog = sys
    ? truncateForModelLog(`【system】\n${sys}\n\n【user】\n${userMessage}`)
    : userMessage

  const responseData: Record<string, unknown> = {}

  if (result.status === 'completed') {
    if (options?.rawResponse) {
      responseData.rawResponse = truncateForModelLog(options.rawResponse, MODEL_LOG_RESPONSE_MAX)
    }
    if (options?.responseMetadata) {
      responseData.metadata = options.responseMetadata
    }
    if (result.cost) {
      responseData.costDetail = {
        inputTokens: result.cost.inputTokens,
        outputTokens: result.cost.outputTokens,
        totalTokens: result.cost.totalTokens,
        ...result.cost.metadata
      }
    }
  } else {
    if (result.errorMsg) {
      responseData.error = result.errorMsg
    }
  }

  await recordModelApiCall({
    userId: log.userId,
    model: result.model || 'unknown',
    provider: result.provider || 'unknown',
    prompt: promptForLog,
    requestParams: { op: log.op, projectId: log.projectId },
    status: result.status,
    cost: result.cost?.costCNY ?? null,
    responseData: Object.keys(responseData).length > 0 ? responseData : undefined,
    errorMsg: result.errorMsg ? truncateForModelLog(String(result.errorMsg), 4000) : undefined
  })
}

/**
 * 兼容旧接口：logDeepSeekChat
 * 内部转发到 logLLMCall
 */
export async function logDeepSeekChat(
  log: ModelCallLogContext | undefined,
  userMessage: string,
  result: {
    status: 'completed' | 'failed'
    costCNY?: number
    errorMsg?: string
    rawContent?: string
  },
  options?: LogLLMCallOptions
): Promise<void> {
  const cost: CostResult | undefined =
    result.costCNY !== undefined
      ? { costCNY: result.costCNY, inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      : undefined

  await logLLMCall(
    log,
    userMessage,
    {
      status: result.status,
      cost,
      errorMsg: result.errorMsg,
      model: 'deepseek-chat',
      provider: 'deepseek'
    },
    options
  )
}
