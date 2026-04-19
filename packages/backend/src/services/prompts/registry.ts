/**
 * 提示词注册中心
 * 集中管理所有提示词模板，提供便捷的查询和注册接口
 */

import { PromptTemplateEngine, type PromptTemplate } from './template-engine.js'
import { SCRIPT_TEMPLATES } from './script-templates.js'
import { CHARACTER_TEMPLATES } from './character-templates.js'
import { LOCATION_TEMPLATES } from './location-templates.js'
import { MEMORY_TEMPLATES } from './memory-templates.js'

export class PromptRegistry {
  private static instance: PromptRegistry
  private initialized = false

  private constructor() {}

  static getInstance(): PromptRegistry {
    if (!PromptRegistry.instance) {
      PromptRegistry.instance = new PromptRegistry()
    }
    return PromptRegistry.instance
  }

  /**
   * 初始化注册中心（注册所有内置模板）
   */
  initialize(): void {
    if (this.initialized) {
      return
    }

    const engine = PromptTemplateEngine.getInstance()

    // 注册所有模板
    engine.registerMany(SCRIPT_TEMPLATES)
    engine.registerMany(CHARACTER_TEMPLATES)
    engine.registerMany(LOCATION_TEMPLATES)
    engine.registerMany(MEMORY_TEMPLATES)

    this.initialized = true
    console.log(`[PromptRegistry] Registered ${this.getAllTemplates().length} templates`)
  }

  /**
   * 获取最新版本的模板
   */
  getLatest(templateId: string): PromptTemplate {
    this.ensureInitialized()
    return PromptTemplateEngine.getInstance().getTemplate(templateId)
  }

  /**
   * 获取指定版本的模板
   */
  getVersion(templateId: string, version: string): PromptTemplate {
    this.ensureInitialized()
    return PromptTemplateEngine.getInstance().getTemplate(templateId, version)
  }

  /**
   * 渲染模板
   */
  render(templateId: string, variables: Record<string, unknown>, version?: string) {
    this.ensureInitialized()
    return PromptTemplateEngine.getInstance().render(templateId, {
      variables,
      version
    })
  }

  /**
   * 获取某分类下的所有模板（最新版本）
   */
  getByCategory(category: string): PromptTemplate[] {
    this.ensureInitialized()
    const allVersions = PromptTemplateEngine.getInstance().getByCategory(category)

    // 去重，只保留每个模板的最新版本
    const latestMap = new Map<string, PromptTemplate>()
    for (const template of allVersions) {
      const existing = latestMap.get(template.id)
      if (!existing || this.compareVersions(template.version, existing.version) > 0) {
        latestMap.set(template.id, template)
      }
    }

    return Array.from(latestMap.values())
  }

  /**
   * 获取所有已注册的模板 ID
   */
  getTemplateIds(): string[] {
    this.ensureInitialized()
    return PromptTemplateEngine.getInstance().getTemplateIds()
  }

  /**
   * 检查模板是否存在
   */
  hasTemplate(templateId: string): boolean {
    this.ensureInitialized()
    return PromptTemplateEngine.getInstance().hasTemplate(templateId)
  }

  /**
   * 注册自定义模板（用于扩展或覆盖）
   */
  register(template: PromptTemplate): void {
    // 即使未初始化也允许注册
    const engine = PromptTemplateEngine.getInstance()
    engine.register(template)

    if (!this.initialized) {
      console.warn(`[PromptRegistry] Registering template "${template.id}" before initialization`)
    }
  }

  /**
   * 获取所有模板（包含所有版本）
   */
  getAllTemplates(): PromptTemplate[] {
    this.ensureInitialized()
    const ids = PromptTemplateEngine.getInstance().getTemplateIds()
    const all: PromptTemplate[] = []

    for (const id of ids) {
      const templates = PromptTemplateEngine.getInstance().getTemplate(id)
      all.push(templates)
    }

    return all
  }

  /**
   * 重置注册中心（主要用于测试）
   */
  static reset(): void {
    if (PromptRegistry.instance) {
      PromptTemplateEngine.reset()
      PromptRegistry.instance.initialized = false
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize()
    }
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)
    const maxLen = Math.max(partsA.length, partsB.length)

    for (let i = 0; i < maxLen; i++) {
      const numA = partsA[i] || 0
      const numB = partsB[i] || 0
      if (numA !== numB) {
        return numA - numB
      }
    }

    return 0
  }
}
