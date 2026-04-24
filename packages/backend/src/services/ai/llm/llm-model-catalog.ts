/**
 * 声明式 LLM 模型配置目录
 * 新增模型只需在此添加配置，无需修改业务代码
 */

import type { TokenPricing } from '../core/cost-calculator.js'

// ==================== DeepSeek V4 定价 ====================

export const DEEPSEEK_V4_PRICING: Record<string, TokenPricing> = {
  'deepseek-v4-flash': {
    inputCacheHitCostPer1M: 0.2,
    inputCacheMissCostPer1M: 1.0,
    outputCostPer1M: 2.0
  },
  'deepseek-v4-pro': {
    inputCacheHitCostPer1M: 1.0,
    inputCacheMissCostPer1M: 12.0,
    outputCostPer1M: 24.0
  }
} as const

/** 旧模型名 → 新 V4 模型映射（兼容过渡期） */
export const DEEPSEEK_MODEL_ALIASES: Record<string, string> = {
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-flash',
  'deepseek-coder': 'deepseek-v4-flash',
  'deepseek-v3': 'deepseek-v4-flash'
} as const

/** 解析模型名（处理别名） */
export function resolveDeepSeekModel(model: string): string {
  return DEEPSEEK_MODEL_ALIASES[model] || model
}

/** 获取 DeepSeek 模型定价 */
export function getDeepSeekPricing(model: string): TokenPricing | null {
  const resolved = resolveDeepSeekModel(model)
  return DEEPSEEK_V4_PRICING[resolved] || null
}

// ==================== OpenAI 定价 ====================

export const OPENAI_PRICING: Record<string, TokenPricing> = {
  'gpt-4o': { inputCostPer1M: 2.5, outputCostPer1M: 10.0 },
  'gpt-4o-mini': { inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
  'gpt-4-turbo': { inputCostPer1M: 10.0, outputCostPer1M: 30.0 },
  'gpt-3.5-turbo': { inputCostPer1M: 0.5, outputCostPer1M: 1.5 }
} as const

/** 获取 OpenAI 模型定价 */
export function getOpenAIPricing(model: string): TokenPricing | null {
  return OPENAI_PRICING[model] || null
}

// ==================== Claude 定价 ====================

export const CLAUDE_PRICING: Record<string, TokenPricing> = {
  'claude-3-5-sonnet-20241022': { inputCostPer1M: 3.0, outputCostPer1M: 15.0 },
  'claude-3-opus-20240229': { inputCostPer1M: 15.0, outputCostPer1M: 75.0 },
  'claude-3-sonnet-20240229': { inputCostPer1M: 3.0, outputCostPer1M: 15.0 },
  'claude-3-haiku-20240307': { inputCostPer1M: 0.25, outputCostPer1M: 1.25 }
} as const

/** 获取 Claude 模型定价 */
export function getClaudePricing(model: string): TokenPricing | null {
  return CLAUDE_PRICING[model] || null
}

// ==================== 通义千问定价 ====================

export const QWEN_PRICING: Record<string, TokenPricing> = {
  'qwen-max': { inputCostPer1M: 20.0, outputCostPer1M: 60.0 },
  'qwen-plus': { inputCostPer1M: 2.0, outputCostPer1M: 6.0 },
  'qwen-turbo': { inputCostPer1M: 0.5, outputCostPer1M: 2.0 }
} as const

/** 获取 Qwen 模型定价 */
export function getQwenPricing(model: string): TokenPricing | null {
  return QWEN_PRICING[model] || null
}

// ==================== 火山方舟 LLM 定价 ====================

export const ARK_LLM_PRICING: Record<string, TokenPricing> = {
  'doubao-pro-32k-241215': { inputCostPer1M: 5.0, outputCostPer1M: 9.0 },
  'doubao-lite-32k-241015': { inputCostPer1M: 0.8, outputCostPer1M: 2.0 }
} as const

/** 获取 Ark LLM 模型定价 */
export function getArkLLMPricing(model: string): TokenPricing | null {
  return ARK_LLM_PRICING[model] || null
}

// ==================== 统一模型信息 ====================

export type { TokenPricing } from '../core/cost-calculator.js'

export interface ModelInfo {
  id: string
  name: string
  provider: string
  description?: string
  maxTokens?: number
  supportsStreaming?: boolean
  supportsVision?: boolean
}

/** 所有支持的 LLM 模型列表 */
export const ALL_LLM_MODELS: ModelInfo[] = [
  // DeepSeek
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'deepseek',
    supportsStreaming: true
  },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', supportsStreaming: true },
  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    supportsStreaming: true,
    supportsVision: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    supportsStreaming: true,
    supportsVision: true
  },
  // Claude
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'claude',
    supportsStreaming: true
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'claude',
    supportsStreaming: true
  },
  // Qwen
  { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen', supportsStreaming: true },
  { id: 'qwen-plus', name: 'Qwen Plus', provider: 'qwen', supportsStreaming: true },
  // Ark
  { id: 'doubao-pro-32k-241215', name: 'Doubao Pro 32K', provider: 'ark', supportsStreaming: true },
  {
    id: 'doubao-lite-32k-241015',
    name: 'Doubao Lite 32K',
    provider: 'ark',
    supportsStreaming: true
  }
]

/** 根据 provider 获取模型列表 */
export function getModelsByProvider(provider: string): ModelInfo[] {
  return ALL_LLM_MODELS.filter((m) => m.provider === provider)
}

/** 获取模型信息 */
export function getModelInfo(modelId: string): ModelInfo | undefined {
  return ALL_LLM_MODELS.find((m) => m.id === modelId)
}

/** 获取模型定价（跨 Provider 统一查询） */
export function getModelPricing(model: string, provider: string): TokenPricing | null {
  switch (provider) {
    case 'deepseek':
      return getDeepSeekPricing(model)
    case 'openai':
      return getOpenAIPricing(model)
    case 'claude':
      return getClaudePricing(model)
    case 'qwen':
      return getQwenPricing(model)
    case 'ark':
      return getArkLLMPricing(model)
    default:
      return null
  }
}
