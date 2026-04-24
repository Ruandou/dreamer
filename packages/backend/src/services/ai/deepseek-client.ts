/**
 * DeepSeek pricing calculator.
 * @deprecated 请使用 llm/llm-model-catalog.ts 中的定价配置
 * 保留此文件以兼容现有调用方
 */

export { DeepSeekAuthError, DeepSeekRateLimitError } from './llm/providers/deepseek-provider.js'

import { calculateTokenCost } from './core/cost-calculator.js'
import { getDeepSeekPricing } from './llm/llm-model-catalog.js'

export interface DeepSeekCost {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCNY: number
  cacheHit?: boolean
}

const TOKENS_PER_MILLION = 1_000_000

/**
 * @deprecated 请使用 llm/providers/deepseek-provider.ts 中的 calculateUsage
 */
export function calculateDeepSeekCost(usage: unknown, cacheHit = false): DeepSeekCost {
  const typedUsage = usage as {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  const inputTokens = typedUsage?.prompt_tokens ?? 0
  const outputTokens = typedUsage?.completion_tokens ?? 0
  const totalTokens = typedUsage?.total_tokens ?? 0

  // 尝试使用新定价配置
  const pricing = getDeepSeekPricing('deepseek-v4-flash')
  if (pricing) {
    const result = calculateTokenCost(inputTokens, outputTokens, pricing, cacheHit)
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      costCNY: result.costCNY,
      cacheHit
    }
  }

  // 回退到旧定价
  const inputCostPerMillion = cacheHit ? 0.2 : 2.0
  const costCNY =
    (inputTokens / TOKENS_PER_MILLION) * inputCostPerMillion +
    (outputTokens / TOKENS_PER_MILLION) * 3.0

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costCNY: Math.round(costCNY * 1_000_000) / 1_000_000,
    cacheHit
  }
}
