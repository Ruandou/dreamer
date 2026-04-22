/**
 * 通用 Prompt 构建器
 * 提供流式 API 构建 AI 提示词，避免重复的数组拼接逻辑
 */

export class PromptBuilder {
  private parts: string[] = []
  private separator: string

  constructor(separator: string = '，') {
    this.separator = separator
  }

  /**
   * 添加文本片段（忽略空值）
   */
  add(text: string | undefined | null): this {
    if (text) {
      this.parts.push(text)
    }
    return this
  }

  /**
   * 条件添加：当 condition 为 true 时添加文本
   */
  addCondition(condition: boolean, text: string): this {
    if (condition) {
      this.parts.push(text)
    }
    return this
  }

  /**
   * 添加数组，使用指定的连接符
   */
  addList(items: string[] | undefined | null, joiner: string = '，'): this {
    if (items?.length) {
      this.parts.push(items.join(joiner))
    }
    return this
  }

  /**
   * 添加带前缀的文本（如 "角色: xxx"）
   */
  addWithPrefix(prefix: string, text: string | undefined | null): this {
    if (text) {
      this.parts.push(`${prefix}${text}`)
    }
    return this
  }

  /**
   * 添加多个文本片段
   */
  addMultiple(...texts: Array<string | undefined | null>): this {
    for (const text of texts) {
      if (text) {
        this.parts.push(text)
      }
    }
    return this
  }

  /**
   * 构建最终提示词
   */
  build(): string {
    return this.parts.join(this.separator)
  }

  /**
   * 检查是否为空
   */
  isEmpty(): boolean {
    return this.parts.length === 0
  }

  /**
   * 获取当前部分数量
   */
  get length(): number {
    return this.parts.length
  }

  /**
   * 重置构建器
   */
  clear(): this {
    this.parts = []
    return this
  }
}

/**
 * 创建 PromptBuilder 的便捷函数
 */
export function createPromptBuilder(separator?: string): PromptBuilder {
  return new PromptBuilder(separator)
}
