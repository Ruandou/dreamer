/**
 * Seedance 参数化步骤处理器
 */

import type { StoryboardSegment, PipelineResult } from '@dreamer/shared/types'
import { buildSeedanceConfigs } from '../ai/seedance-optimizer.js'
import type { PipelineStepHandler } from './types.js'
import type { PipelineExecuteOptions, PipelineStepResult } from '../pipeline-orchestrator.js'

export class SeedanceParametrizationHandler implements PipelineStepHandler {
  readonly step = 'seedance-parametrization' as const

  execute(
    previousResults: Partial<PipelineResult>,
    _context: unknown,
    _options?: PipelineExecuteOptions
  ): Promise<PipelineStepResult> {
    const storyboard = previousResults.storyboard
    if (!storyboard) {
      return Promise.resolve({
        step: this.step,
        status: 'failed',
        error: '缺少 storyboard 数据'
      })
    }

    const startTime = Date.now()
    try {
      const data = buildSeedanceConfigs(storyboard as StoryboardSegment[])
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
    return !!previousResults.storyboard
  }
}

export const seedanceParametrizationHandler = new SeedanceParametrizationHandler()
