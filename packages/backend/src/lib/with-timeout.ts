/**
 * Generic Promise timeout utility.
 * Replaces repetitive `Promise.race` + `setTimeout` patterns.
 */

/** Milliseconds per second. */
const MS_PER_SECOND = 1000

/** Seconds per minute. */
const SECONDS_PER_MINUTE = 60

/**
 * Attach a timeout guard to a Promise.
 *
 * @param promise   The operation to guard.
 * @param timeoutMs Timeout in milliseconds.
 * @param errorMessage Error message when timeout fires.
 * @throws The original promise rejection or a timeout Error.
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
 * Build a human-readable timeout error message (minutes).
 *
 * Why minutes: most pipeline operations (outline generation, review,
 * visual enrichment) are measured in minutes; showing seconds would be noisy.
 */
export function timeoutErrorMessage(label: string, timeoutMs: number): string {
  const minutes = timeoutMs / MS_PER_SECOND / SECONDS_PER_MINUTE
  return `${label}超时（${minutes}分钟），请检查API连接`
}
