/**
 * 提示词模板引擎
 * 支持变量插值、模板注册、版本控制和环境覆盖
 */

export interface PromptTemplate {
  /** 模板唯一标识 */
  id: string;
  /** 语义化版本号 */
  version: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 用户提示词模板（支持 {{variable}} 语法） */
  userPromptTemplate: string;
  /** 模板元数据 */
  metadata: {
    /** 提示词分类 */
    category:
      | "script"
      | "character"
      | "location"
      | "storyboard"
      | "visual"
      | "memory";
    /** 创造性程度 0-1，对应 temperature */
    creativity: number;
    /** 最大输出 token 数 */
    maxOutputTokens: number;
    /** 模板描述 */
    description: string;
    /** 可选：模板标签，用于分组和检索 */
    tags?: string[];
  };
}

export interface RenderedPrompt {
  /** 渲染后的系统提示词 */
  systemPrompt: string;
  /** 渲染后的用户提示词 */
  userPrompt: string;
  /** 使用的模板 ID */
  templateId: string;
  /** 使用的模板版本 */
  templateVersion: string;
}

export interface TemplateRenderOptions {
  /** 变量映射 */
  variables: Record<string, any>;
  /** 可选：指定模板版本，默认使用最新版本 */
  version?: string;
}

/**
 * 提示词模板引擎
 * 负责模板注册、变量插值和版本管理
 */
export class PromptTemplateEngine {
  private static instance: PromptTemplateEngine;
  private templates: Map<string, PromptTemplate[]> = new Map();

  private constructor() {}

  static getInstance(): PromptTemplateEngine {
    if (!PromptTemplateEngine.instance) {
      PromptTemplateEngine.instance = new PromptTemplateEngine();
    }
    return PromptTemplateEngine.instance;
  }

  /**
   * 注册模板（支持同一模板多个版本）
   */
  register(template: PromptTemplate): void {
    const existing = this.templates.get(template.id) || [];

    // 检查版本号是否已存在
    if (existing.some((t) => t.version === template.version)) {
      throw new Error(
        `Template "${template.id}" version "${template.version}" already registered`,
      );
    }

    existing.push(template);
    // 按版本号排序（语义化版本）
    existing.sort((a, b) => this.compareVersions(a.version, b.version));
    this.templates.set(template.id, existing);
  }

  /**
   * 批量注册模板
   */
  registerMany(templates: PromptTemplate[]): void {
    templates.forEach((t) => this.register(t));
  }

  /**
   * 获取模板（默认最新版本）
   */
  getTemplate(templateId: string, version?: string): PromptTemplate {
    const templates = this.templates.get(templateId);
    if (!templates || templates.length === 0) {
      throw new Error(`Template "${templateId}" not found`);
    }

    if (version) {
      const specific = templates.find((t) => t.version === version);
      if (!specific) {
        throw new Error(
          `Template "${templateId}" version "${version}" not found. Available: ${templates.map((t) => t.version).join(", ")}`,
        );
      }
      return specific;
    }

    // 返回最新版本（已排序）
    return templates[templates.length - 1];
  }

  /**
   * 渲染模板（变量插值）
   */
  render(templateId: string, options: TemplateRenderOptions): RenderedPrompt {
    const template = this.getTemplate(templateId, options.version);
    const { variables } = options;

    const systemPrompt = this.interpolate(template.systemPrompt, variables);
    const userPrompt = this.interpolate(template.userPromptTemplate, variables);

    return {
      systemPrompt,
      userPrompt,
      templateId: template.id,
      templateVersion: template.version,
    };
  }

  /**
   * 便捷方法：直接渲染（无需构建 options 对象）
   */
  static render(
    templateId: string,
    variables: Record<string, any>,
    version?: string,
  ): RenderedPrompt {
    return this.getInstance().render(templateId, { variables, version });
  }

  /**
   * 获取某分类下的所有模板
   */
  getByCategory(category: string): PromptTemplate[] {
    const result: PromptTemplate[] = [];
    for (const templates of this.templates.values()) {
      for (const template of templates) {
        if (template.metadata.category === category) {
          result.push(template);
        }
      }
    }
    return result;
  }

  /**
   * 获取所有已注册的模板 ID
   */
  getTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * 检查模板是否存在
   */
  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }

  /**
   * 变量插值：将 {{variable}} 替换为实际值
   * 支持嵌套访问：{{user.name}}
   * 支持条件块：{{#variable}}...{{/variable}}（仅当 variable 有值时渲染）
   * 支持数组迭代：{{#array}}...{{.}}...{{/array}}
   */
  private interpolate(
    template: string,
    variables: Record<string, any>,
  ): string {
    // 先处理条件块和数组迭代
    let result = this.processSections(template, variables);
    // 再处理简单变量
    result = this.replaceVariables(result, variables);
    return result;
  }

  /**
   * 处理条件块和数组迭代（{{#...}}...{{/...}}）
   */
  private processSections(
    template: string,
    variables: Record<string, any>,
  ): string {
    // 匹配 {{#section}}...{{/section}}
    const sectionRegex = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

    return template.replace(sectionRegex, (match, path, content) => {
      const value = this.resolvePath(variables, path.trim());

      // 如果值为空或 false，移除整个块
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return "";
      }

      // 如果是数组，迭代渲染
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            // {{.}} 代表数组项本身
            let itemContent = content.replace(/\{\{\.\}\}/g, String(item));
            // 如果数组项是对象，支持访问其属性
            if (typeof item === "object" && item !== null) {
              itemContent = this.replaceVariables(itemContent, item);
            }
            return itemContent;
          })
          .join("");
      }

      // 如果是普通值，渲染内容块（支持嵌套变量）
      if (typeof value === "object") {
        return this.replaceVariables(content, value);
      }

      return content;
    });
  }

  /**
   * 替换简单变量
   */
  private replaceVariables(
    template: string,
    variables: Record<string, any>,
  ): string {
    return template.replace(/\{\{([^#/}][^}]*)\}\}/g, (match, path) => {
      const value = this.resolvePath(variables, path.trim());
      if (value === undefined || value === null) {
        console.warn(
          `[PromptTemplateEngine] Variable "${path}" not found in variables`,
        );
        return "";
      }
      return String(value);
    });
  }

  /**
   * 解析嵌套路径（如 "user.name"）
   */
  private resolvePath(obj: Record<string, any>, path: string): any {
    const parts = path.split(".");
    let current: any = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * 语义化版本号比较
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA !== numB) {
        return numA - numB;
      }
    }

    return 0;
  }

  /**
   * 重置引擎（主要用于测试）
   */
  static reset(): void {
    if (PromptTemplateEngine.instance) {
      PromptTemplateEngine.instance.templates.clear();
    }
  }
}
