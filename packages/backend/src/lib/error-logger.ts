/**
 * 结构化错误日志工具
 * 提供统一的错误日志格式，包含上下文信息便于排障
 */

export interface ErrorLogContext {
  /** 操作名称或模块 */
  operation: string
  /** 关键标识符（如 episodeId, projectId 等） */
  metadata?: Record<string, unknown>
  /** 额外信息 */
  message?: string
}

/**
 * 记录结构化错误日志
 *
 * @example
 * ```typescript
 * catch (error) {
 *   logError('ScriptExpansion', error, {
 *     episodeId,
 *     projectId,
 *     operation: 'expand_episode_script'
 *   })
 * }
 * ```
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  console.error(`[${context}] ${errorMessage}`, {
    timestamp: new Date().toISOString(),
    context,
    ...metadata,
    ...(errorStack && { stack: errorStack })
  })
}

/**
 * 记录信息日志（一般操作信息）
 */
export function logInfo(
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  console.log(`[${context}] ${message}`, {
    timestamp: new Date().toISOString(),
    context,
    ...metadata
  })
}

/**
 * 记录警告日志（非致命错误）
 */
export function logWarning(
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  console.warn(`[${context}] ${message}`, {
    timestamp: new Date().toISOString(),
    context,
    ...metadata
  })
}

/**
 * 记录操作开始日志
 */
export function logOperationStart(context: string, metadata?: Record<string, unknown>): void {
  console.log(`[${context}] Operation started`, {
    timestamp: new Date().toISOString(),
    context,
    ...metadata
  })
}

/**
 * 记录操作完成日志
 */
export function logOperationComplete(
  context: string,
  durationMs?: number,
  metadata?: Record<string, unknown>
): void {
  console.log(`[${context}] Operation completed`, {
    timestamp: new Date().toISOString(),
    context,
    ...(durationMs !== undefined && { durationMs }),
    ...metadata
  })
}
