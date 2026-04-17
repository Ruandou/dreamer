import { recordModelApiCall, truncateForModelLog, type ModelCallLogContext } from './api-logger.js'

export type { ModelCallLogContext }

export interface LogDeepSeekChatOptions {
  /** 一并落库，便于模型日志页查看完整对话（含勘景四段式等 system） */
  systemMessage?: string
}

/** DeepSeek chat.completions：成功或失败后写入 ModelApiCall + 终端摘要 */
export async function logDeepSeekChat(
  log: ModelCallLogContext | undefined,
  userMessage: string,
  result: { status: 'completed' | 'failed'; costCNY?: number; errorMsg?: string },
  options?: LogDeepSeekChatOptions
): Promise<void> {
  if (!log) {
    console.warn(
      '[model-api] DeepSeek 调用未写入 ModelApiCall：缺少 ModelCallLogContext（成功/失败均不落库）。请检查调用方是否传入 userId + op。'
    )
    return
  }
  const sys = options?.systemMessage?.trim()
  const promptForLog = sys
    ? truncateForModelLog(`【system】\n${sys}\n\n【user】\n${userMessage}`)
    : userMessage
  await recordModelApiCall({
    userId: log.userId,
    model: 'deepseek-chat',
    provider: 'deepseek',
    prompt: promptForLog,
    requestParams: { op: log.op, projectId: log.projectId },
    status: result.status,
    cost: result.costCNY ?? null,
    errorMsg: result.errorMsg ? truncateForModelLog(String(result.errorMsg), 4000) : undefined
  })
}
