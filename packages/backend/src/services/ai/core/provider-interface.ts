/**
 * 统一 Provider 基础接口
 * 所有 AI 服务（LLM / 图片 / 视频 / 搜索）共享的基础抽象
 */

/** Provider 类型 */
export type ProviderType = 'llm' | 'image' | 'video' | 'search'

/** Provider 基础配置 */
export interface ProviderConfig {
  /** 提供者标识名 */
  provider: string
  /** API Key */
  apiKey: string
  /** API 基础 URL（可选） */
  baseURL?: string
  /** 默认模型名称（可选） */
  defaultModel?: string
}

/** 所有 AI Provider 的基础接口 */
export interface BaseProvider {
  /** Provider 标识名 */
  readonly name: string
  /** Provider 类型 */
  readonly type: ProviderType
  /** 获取当前配置 */
  getConfig(): ProviderConfig
}

/** 统一成本结果 */
export interface CostResult {
  /** 估算成本（人民币） */
  costCNY: number
  /** 输入 token 数（LLM 等） */
  inputTokens: number
  /** 输出 token 数（LLM 等） */
  outputTokens: number
  /** 总 token 数 */
  totalTokens: number
  /** 其他 Provider 特定指标 */
  metadata?: Record<string, unknown>
}

/** 统一 API 调用结果 */
export interface ApiCallResult {
  /** Provider 名称 */
  provider: string
  /** 使用的模型 */
  model: string
  /** 成本信息 */
  cost: CostResult | null
  /** 原始响应 */
  rawResponse: unknown
}

/** Provider 工厂函数类型 */
export type ProviderFactory<T extends BaseProvider> = (config: ProviderConfig) => T
