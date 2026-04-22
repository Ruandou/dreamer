/**
 * 操作上下文类型
 * 用于统一传递 userId、projectId 和 operation 信息
 */

/** 操作上下文 */
export interface ModelCallLogContext {
  /** 用户 ID */
  userId: string
  /** 项目 ID（可选） */
  projectId?: string
  /** 操作标识 */
  op: string
}

/**
 * 创建操作上下文（便捷函数）
 */
export function createModelCallContext(
  userId: string,
  projectId: string,
  op: string
): ModelCallLogContext {
  return { userId, projectId, op }
}
