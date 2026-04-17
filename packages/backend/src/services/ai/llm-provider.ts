/**
 * LLM 提供者抽象接口
 * 定义与具体提供商无关的统一接口，支持 DeepSeek/OpenAI/Claude 等
 */

/** LLM 消息角色 */
export type LLMRole = 'system' | 'user' | 'assistant'

/** LLM 消息 */
export interface LLMMessage {
  role: LLMRole
  content: string
}

/** LLM 使用量统计 */
export interface LLMUsage {
  /** 输入 token 数 */
  inputTokens: number
  /** 输出 token 数 */
  outputTokens: number
  /** 总 token 数 */
  totalTokens: number
  /** 估算成本（人民币） */
  costCNY: number
}

/** LLM 完成结果 */
export interface LLMCompletion {
  /** 生成的文本内容 */
  content: string
  /** 使用量统计 */
  usage: LLMUsage
  /** 使用的模型名称 */
  model: string
  /** 原始响应（提供商特定） */
  rawResponse: unknown
}

/** LLM 提供者配置 */
export interface LLMProviderConfig {
  /** 提供者名称 */
  provider: 'deepseek' | 'openai' | 'claude' | string
  /** API Key */
  apiKey: string
  /** API 基础 URL（可选） */
  baseURL?: string
  /** 默认模型名称（可选） */
  defaultModel?: string
}

/** LLM 完成选项 */
export interface LLMCompletionOptions {
  /** 温度（创造性程度 0-2） */
  temperature?: number
  /** 最大输出 token 数 */
  maxTokens?: number
  /** 模型名称（覆盖默认） */
  model?: string
  /** 顶部采样 */
  topP?: number
  /** 其他提供商特定选项 */
  extra?: Record<string, any>
}

/** LLM 提供者接口 */
export interface LLMProvider {
  /** 提供者名称 */
  readonly name: string

  /**
   * 执行对话完成请求
   * @param messages 消息数组
   * @param options 完成选项
   * @returns 完成结果
   */
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletion>

  /**
   * 获取提供者配置
   */
  getConfig(): LLMProviderConfig
}

/** LLM 提供者工厂函数类型 */
export type LLMProviderFactory = (config: LLMProviderConfig) => LLMProvider
