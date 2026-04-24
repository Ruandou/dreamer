/**
 * 统一成本计算接口
 * 各 Provider 实现各自的计价逻辑
 */

import type { CostResult } from './provider-interface.js'

/** 成本计算器接口 */
export interface CostCalculator {
  /** 计算成本 */
  calculate(usage: unknown, options?: Record<string, unknown>): CostResult
}

/** Token 计价通用计算器 */
export interface TokenPricing {
  /** 输入 token 单价（元/百万 tokens） */
  inputCostPer1M?: number
  /** 输出 token 单价（元/百万 tokens） */
  outputCostPer1M: number
  /** 缓存命中输入单价（可选） */
  inputCacheHitCostPer1M?: number
  /** 缓存未命中输入单价（可选） */
  inputCacheMissCostPer1M?: number
}

const TOKENS_PER_MILLION = 1_000_000

/**
 * 基于 token 用量的通用成本计算
 */
export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  pricing: TokenPricing,
  cacheHit = false
): CostResult {
  const inputCostPerM =
    cacheHit && pricing.inputCacheHitCostPer1M !== undefined
      ? pricing.inputCacheHitCostPer1M
      : pricing.inputCacheMissCostPer1M !== undefined
        ? pricing.inputCacheMissCostPer1M
        : (pricing.inputCostPer1M ?? 0)

  const costCNY =
    (inputTokens / TOKENS_PER_MILLION) * inputCostPerM +
    (outputTokens / TOKENS_PER_MILLION) * pricing.outputCostPer1M

  return {
    costCNY: Math.round(costCNY * 1_000_000) / 1_000_000,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    metadata: { cacheHit }
  }
}

/**
 * 按次计费的通用计算
 */
export function calculatePerCallCost(flatFeeCNY: number): CostResult {
  return {
    costCNY: flatFeeCNY,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    metadata: { billingType: 'per_call' }
  }
}

/**
 * 按时长计费的通用计算（视频等）
 */
export function calculateDurationCost(durationSeconds: number, cnyPerSecond: number): CostResult {
  const costCNY = durationSeconds * cnyPerSecond
  return {
    costCNY: Math.round(costCNY * 1_000_000) / 1_000_000,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    metadata: { durationSeconds, cnyPerSecond }
  }
}

/**
 * 按 token 量计费的通用计算（图片等）
 */
export function calculateTokenQuantityCost(
  tokens: number,
  cnyPerMillionTokens: number
): CostResult {
  const costCNY = (tokens / TOKENS_PER_MILLION) * cnyPerMillionTokens
  return {
    costCNY: Math.round(costCNY * 1_000_000) / 1_000_000,
    inputTokens: tokens,
    outputTokens: 0,
    totalTokens: tokens,
    metadata: { cnyPerMillionTokens }
  }
}
