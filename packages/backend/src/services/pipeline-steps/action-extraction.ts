/**
 * 动作提取步骤处理器
 */

import type { ScriptContent, PipelineResult } from '@dreamer/shared/types'
import { extractActionsFromScenes } from '../action-extractor.js'
import type { PipelineStepHandler } from './types.js'
import type {
  PipelineContext,
  PipelineExecuteOptions,
  PipelineStepResult
} from '../pipeline-orchestrator.js'

export class ActionExtractionHandler implements PipelineStepHandler {
  readonly step = 'action-extraction' as const

  execute(
    previousResults: Partial<PipelineResult>,
    context: PipelineContext,
    _options?: PipelineExecuteOptions
  ): Promise<PipelineStepResult> {
    const script = previousResults.script
    if (!script) {
      return Promise.resolve({
        step: this.step,
        status: 'failed',
        error: '缺少 script 数据'
      })
    }

    const startTime = Date.now()
    try {
      const data = extractActionsFromScenes((script as ScriptContent).scenes, context.characters)
      return Promise.resolve({
        step: this.step,
        status: 'completed',
        data,
        duration: Date.now() - startTime
      })
    } catch (error) {
      return Promise.resolve({
        step: this.step,
        status: 'failed',
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      })
    }
  }

  validateDependencies(previousResults: Partial<PipelineResult>): boolean {
    return !!previousResults.script
  }
}

export const actionExtractionHandler = new ActionExtractionHandler()
