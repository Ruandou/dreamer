/**
 * 通用 Promise 超时工具
 * 替代重复的 Promise.race + setTimeout 模式
 */

/**
 * 为 Promise 添加超时保护
 * @param promise 要执行的操作
 * @param timeoutMs 超时毫秒数
 * @param errorMessage 超时时的错误消息
 * @throws 超时或原 promise 的错误
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs))
  ])
}

/**
 * 构建超时错误消息（分钟单位）
 */
export function timeoutErrorMessage(label: string, timeoutMs: number): string {
  return `${label}超时（${timeoutMs / 1000 / 60}分钟），请检查API连接`
}
