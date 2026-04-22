/**
 * Pipeline 步骤策略接口
 */

import type { PipelineStep, PipelineResult } from '@dreamer/shared/types'
import type {
  PipelineContext,
  PipelineExecuteOptions,
  PipelineStepResult
} from '../pipeline-orchestrator.js'

/**
 * Pipeline 步骤处理器接口
 * 每个步骤实现此接口以提供独立的执行逻辑
 */
export interface PipelineStepHandler {
  /** 步骤名称 */
  readonly step: PipelineStep

  /**
   * 执行步骤
   * @param previousResults 前面步骤的结果
   * @param context Pipeline 上下文
   * @param options 执行选项
   */
  execute(
    previousResults: Partial<PipelineResult>,
    context: PipelineContext,
    options?: PipelineExecuteOptions
  ): Promise<PipelineStepResult>

  /**
   * 验证前置依赖是否满足
   */
  validateDependencies(previousResults: Partial<PipelineResult>): boolean
}

/**
 * 步骤注册表类型
 */
export type StepRegistry = Map<PipelineStep, PipelineStepHandler>
