/**
 * DeepSeek pricing calculator.
 *
 * Source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
 * Prices are in CNY per 1M tokens.
 */

const DEEPSEEK_INPUT_COST_PER_1M_CACHE_HIT = 0.2
const DEEPSEEK_INPUT_COST_PER_1M_CACHE_MISS = 2.0
const DEEPSEEK_OUTPUT_COST_PER_1M = 3.0

/** Number of tokens per million (for cost calculation). */
const TOKENS_PER_MILLION = 1_000_000

export interface DeepSeekCost {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCNY: number
  cacheHit?: boolean
}

export class DeepSeekAuthError extends Error {
  constructor(message = 'DeepSeek API 认证失败，请检查 API Key') {
    super(message)
    this.name = 'DeepSeekAuthError'
  }
}

export class DeepSeekRateLimitError extends Error {
  constructor(message = 'DeepSeek API 请求过于频繁，请稍后重试') {
    super(message)
    this.name = 'DeepSeekRateLimitError'
  }
}

export function calculateDeepSeekCost(usage: unknown, cacheHit = false): DeepSeekCost {
  const typedUsage = usage as {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  const inputTokens = typedUsage?.prompt_tokens ?? 0
  const outputTokens = typedUsage?.completion_tokens ?? 0
  const totalTokens = typedUsage?.total_tokens ?? 0

  const inputCostPerMillion = cacheHit
    ? DEEPSEEK_INPUT_COST_PER_1M_CACHE_HIT
    : DEEPSEEK_INPUT_COST_PER_1M_CACHE_MISS

  const costCNY =
    (inputTokens / TOKENS_PER_MILLION) * inputCostPerMillion +
    (outputTokens / TOKENS_PER_MILLION) * DEEPSEEK_OUTPUT_COST_PER_1M

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costCNY,
    cacheHit
  }
}
