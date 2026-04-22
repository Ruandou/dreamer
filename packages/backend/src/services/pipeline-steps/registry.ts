/**
 * Pipeline 步骤注册表
 * 使用 Registry 模式管理所有步骤处理器
 */

import type { PipelineStep } from '@dreamer/shared/types'
import type { PipelineStepHandler, StepRegistry } from './types.js'
import { scriptWritingHandler } from './script-writing.js'
import { episodeSplittingHandler } from './episode-splitting.js'
import { actionExtractionHandler } from './action-extraction.js'
import { assetMatchingHandler } from './asset-matching.js'
import { storyboardGenerationHandler } from './storyboard-generation.js'
import { seedanceParametrizationHandler } from './seedance-parametrization.js'

class PipelineStepRegistry {
  private registry: StepRegistry = new Map()

  /**
   * 注册步骤处理器
   */
  register(handler: PipelineStepHandler): void {
    this.registry.set(handler.step, handler)
  }

  /**
   * 获取步骤处理器
   */
  getHandler(step: PipelineStep): PipelineStepHandler | undefined {
    return this.registry.get(step)
  }

  /**
   * 获取所有已注册的步骤
   */
  getAllSteps(): PipelineStep[] {
    return Array.from(this.registry.keys())
  }

  /**
   * 检查步骤是否已注册
   */
  hasStep(step: PipelineStep): boolean {
    return this.registry.has(step)
  }

  /**
   * 获取已注册的步骤数量
   */
  get size(): number {
    return this.registry.size
  }
}

// 创建全局注册表实例
export const pipelineStepRegistry = new PipelineStepRegistry()

// 注册所有步骤处理器
pipelineStepRegistry.register(scriptWritingHandler)
pipelineStepRegistry.register(episodeSplittingHandler)
pipelineStepRegistry.register(actionExtractionHandler)
pipelineStepRegistry.register(assetMatchingHandler)
pipelineStepRegistry.register(storyboardGenerationHandler)
pipelineStepRegistry.register(seedanceParametrizationHandler)

/**
 * 获取步骤处理器（便捷函数）
 */
export function getPipelineStepHandler(step: PipelineStep): PipelineStepHandler | undefined {
  return pipelineStepRegistry.getHandler(step)
}

/**
 * 获取所有已注册的步骤
 */
export function getAllPipelineSteps(): PipelineStep[] {
  return pipelineStepRegistry.getAllSteps()
}
