/**
 * 剧本模式路由器
 * 根据项目描述检测剧本模式并路由到对应的处理器
 */

import { detectScriptMode } from '../script-mode-detector.js'

export class ScriptModeRouter {
  /**
   * 根据项目描述检测剧本模式
   */
  detectMode(description: string) {
    return detectScriptMode(description)
  }

  /**
   * 判断是否为完整剧本模式
   */
  isFaithfulParse(description: string): boolean {
    return this.detectMode(description).mode === 'faithful-parse'
  }

  /**
   * 判断是否为混合模式
   */
  isMixedMode(description: string): boolean {
    return this.detectMode(description).mode === 'mixed'
  }

  /**
   * 判断是否为 AI 创作模式
   */
  isAICreation(description: string): boolean {
    return this.detectMode(description).mode === 'ai-create'
  }
}

export const scriptModeRouter = new ScriptModeRouter()
