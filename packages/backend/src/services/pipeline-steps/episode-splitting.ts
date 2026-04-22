/**
 * 分集步骤处理器
 */

import type { ScriptContent, PipelineResult } from '@dreamer/shared/types'
import { splitIntoEpisodes } from '../episode-splitter.js'
import type { PipelineStepHandler } from './types.js'
import type {
  PipelineContext,
  PipelineExecuteOptions,
  PipelineStepResult
} from '../pipeline-orchestrator.js'

export class EpisodeSplittingHandler implements PipelineStepHandler {
  readonly step = 'episode-splitting' as const

  execute(
    previousResults: Partial<PipelineResult>,
    _context: PipelineContext,
    options?: PipelineExecuteOptions
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
      const data = splitIntoEpisodes(script as ScriptContent, {
        targetDuration: options?.customOptions?.targetDuration || 60
      })
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

export const episodeSplittingHandler = new EpisodeSplittingHandler()
