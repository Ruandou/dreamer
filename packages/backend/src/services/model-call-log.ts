import {
  recordModelApiCall,
  type ModelCallLogContext
} from './api-logger.js'

export type { ModelCallLogContext }

/** DeepSeek chat.completions：成功或失败后写入 ModelApiCall + 终端摘要 */
export async function logDeepSeekChat(
  log: ModelCallLogContext | undefined,
  userMessage: string,
  result: { status: 'completed' | 'failed'; costCNY?: number; errorMsg?: string }
): Promise<void> {
  if (!log) return
  await recordModelApiCall({
    userId: log.userId,
    model: 'deepseek-chat',
    provider: 'deepseek',
    prompt: userMessage,
    requestParams: { op: log.op, projectId: log.projectId },
    status: result.status,
    cost: result.costCNY ?? null,
    errorMsg: result.errorMsg
  })
}
