/**
 * 剧本生成步骤处理器
 * 注意：此步骤不能单独执行，需要原始 idea
 */

import type { PipelineResult } from '@dreamer/shared/types'
import type { PipelineStepHandler } from './types.js'
import type {
  PipelineContext,
  PipelineExecuteOptions,
  PipelineStepResult
} from '../pipeline-orchestrator.js'

export class ScriptWritingHandler implements PipelineStepHandler {
  readonly step = 'script-writing' as const

  execute(
    _previousResults: Partial<PipelineResult>,
    _context: PipelineContext,
    _options?: PipelineExecuteOptions
  ): Promise<PipelineStepResult> {
    return Promise.resolve({
      step: this.step,
      status: 'failed',
      error: 'script-writing 步骤需要原始 idea，无法单独执行'
    })
  }

  validateDependencies(_previousResults: Partial<PipelineResult>): boolean {
    // script-writing 不需要依赖，但也不能单独执行
    return true
  }
}

export const scriptWritingHandler = new ScriptWritingHandler()
