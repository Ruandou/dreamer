import {
  recordModelApiCall,
  truncateForModelLog,
  MODEL_LOG_RESPONSE_MAX,
  type ModelCallLogContext
} from './api-logger.js'
import { logWarning } from '../../lib/error-logger.js'

export type { ModelCallLogContext }

export interface LogDeepSeekChatOptions {
  /** 一并落库，便于模型日志页查看完整对话（含勘景四段式等 system） */
  systemMessage?: string
  /** 完整响应内容（成功时） */
  rawResponse?: string
  /** 完整的响应元数据（token usage等） */
  responseMetadata?: Record<string, unknown>
}

/** DeepSeek chat.completions：成功或失败后写入 ModelApiCall + 终端摘要 */
export async function logDeepSeekChat(
  log: ModelCallLogContext | undefined,
  userMessage: string,
  result: {
    status: 'completed' | 'failed'
    costCNY?: number
    errorMsg?: string
    rawContent?: string
  },
  options?: LogDeepSeekChatOptions
): Promise<void> {
  if (!log) {
    logWarning(
      'ModelAPI',
      'DeepSeek 调用未写入 ModelApiCall：缺少 ModelCallLogContext（成功/失败均不落库）。请检查调用方是否传入 userId + op。'
    )
    return
  }

  const sys = options?.systemMessage?.trim()
  const promptForLog = sys
    ? truncateForModelLog(`【system】\n${sys}\n\n【user】\n${userMessage}`)
    : userMessage

  // 构建 responseData - 包含完整输出
  const responseData: Record<string, unknown> = {}

  if (result.status === 'completed') {
    // 成功时：记录完整输出
    if (result.rawContent) {
      responseData.output = truncateForModelLog(result.rawContent, MODEL_LOG_RESPONSE_MAX)
      responseData.outputFullLength = result.rawContent.length
    }
    if (options?.rawResponse) {
      responseData.rawResponse = truncateForModelLog(options.rawResponse, MODEL_LOG_RESPONSE_MAX)
    }
    if (options?.responseMetadata) {
      responseData.metadata = options.responseMetadata
    }
  } else {
    // 失败时：记录完整错误
    if (result.errorMsg) {
      responseData.error = result.errorMsg
    }
  }

  await recordModelApiCall({
    userId: log.userId,
    model: 'deepseek-chat',
    provider: 'deepseek',
    prompt: promptForLog,
    requestParams: { op: log.op, projectId: log.projectId },
    status: result.status,
    cost: result.costCNY ?? null,
    responseData: Object.keys(responseData).length > 0 ? responseData : undefined,
    errorMsg: result.errorMsg ? truncateForModelLog(String(result.errorMsg), 4000) : undefined
  })
}
