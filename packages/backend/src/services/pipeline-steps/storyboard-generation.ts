/**
 * 分镜生成步骤处理器
 */

import type {
  ScriptContent,
  EpisodePlan,
  StoryboardSegment,
  PipelineResult
} from '@dreamer/shared/types'
import { generateStoryboard } from '../storyboard-generator.js'
import type { PipelineStepHandler } from './types.js'
import type {
  PipelineContext,
  PipelineExecuteOptions,
  PipelineStepResult
} from '../pipeline-orchestrator.js'

export class StoryboardGenerationHandler implements PipelineStepHandler {
  readonly step = 'storyboard-generation' as const

  execute(
    previousResults: Partial<PipelineResult>,
    _context: PipelineContext,
    options?: PipelineExecuteOptions
  ): Promise<PipelineStepResult> {
    if (!previousResults.episodes || !previousResults.assetRecommendations) {
      return Promise.resolve({
        step: this.step,
        status: 'failed',
        error: '缺少必要数据'
      })
    }

    const startTime = Date.now()
    try {
      const allSegments: StoryboardSegment[] = []
      const episodes = previousResults.episodes as EpisodePlan[]
      const script = previousResults.script as ScriptContent

      if (!episodes || !script) {
        return Promise.resolve({
          step: this.step,
          status: 'completed',
          data: [],
          duration: Date.now() - startTime
        })
      }

      for (const episode of episodes) {
        const segments = generateStoryboard(
          episode,
          script.scenes,
          previousResults.assetRecommendations,
          {
            defaultAspectRatio: options?.customOptions?.defaultAspectRatio || '9:16'
          }
        )
        allSegments.push(...segments)
      }

      return Promise.resolve({
        step: this.step,
        status: 'completed',
        data: allSegments,
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
    return !!previousResults.episodes && !!previousResults.assetRecommendations
  }
}

export const storyboardGenerationHandler = new StoryboardGenerationHandler()
