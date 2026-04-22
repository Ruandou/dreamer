/**
 * 素材匹配步骤处理器
 */

import type { ScriptContent, PipelineResult } from '@dreamer/shared/types'
import { matchAssetsForScenes, convertCharacterImagesToAssets } from '../scene-asset.js'
import type { PipelineStepHandler } from './types.js'
import type {
  PipelineContext,
  PipelineExecuteOptions,
  PipelineStepResult
} from '../pipeline-orchestrator.js'

export class AssetMatchingHandler implements PipelineStepHandler {
  readonly step = 'asset-matching' as const

  execute(
    previousResults: Partial<PipelineResult>,
    context: PipelineContext,
    _options?: PipelineExecuteOptions
  ): Promise<PipelineStepResult> {
    const script = previousResults.script
    const sceneActions = previousResults.sceneActions
    if (!script || !sceneActions) {
      return Promise.resolve({
        step: this.step,
        status: 'failed',
        error: '缺少必要数据'
      })
    }

    const startTime = Date.now()
    try {
      const projectAssets = [
        ...convertCharacterImagesToAssets(context.characterImages),
        ...context.projectAssets
      ]
      const data = matchAssetsForScenes(
        (script as ScriptContent).scenes,
        projectAssets,
        sceneActions
      )
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
    return !!previousResults.script && !!previousResults.sceneActions
  }
}

export const assetMatchingHandler = new AssetMatchingHandler()
