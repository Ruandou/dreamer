/**
 * 流水线编排服务
 * 协调整个 AI 短剧生产流水线
 */

import type {
  ScriptContent,
  EpisodePlan,
  SceneActions,
  SceneAssetRecommendation,
  StoryboardSegment,
  SeedanceSegmentConfig,
  PipelineStep,
  PipelineResult,
  Character,
  CharacterImage
} from '@dreamer/shared/types'

import { writeScriptFromIdea, improveScript, optimizeSceneDescription } from './script-writer.js'

import { splitIntoEpisodes } from './episode-splitter.js'

import { extractActionsFromScenes, extractActionsFromScene } from './action-extractor.js'

import {
  matchAssetsForScenes,
  convertCharacterImagesToAssets,
  type ProjectAsset
} from './scene-asset.js'

import { generateStoryboard } from './storyboard-generator.js'

import { buildSeedanceConfigs, validateSeedanceConfig } from './ai/seedance-optimizer.js'

export interface PipelineContext {
  projectId: string
  userId: string
  characters: Character[]
  characterImages: CharacterImage[]
  projectAssets: ProjectAsset[]
}

export interface PipelineExecuteOptions {
  runAllSteps?: boolean // 是否运行所有步骤
  startFromStep?: PipelineStep // 从哪一步开始
  endAtStep?: PipelineStep // 到哪一步结束
  customOptions?: {
    targetEpisodes?: number
    targetDuration?: number
    defaultAspectRatio?: '16:9' | '9:16' | '1:1'
    defaultResolution?: '480p' | '720p'
  }
}

export interface PipelineStepResult<T = unknown> {
  step: PipelineStep
  status: 'completed' | 'failed' | 'skipped'
  data?: T
  error?: string
  duration?: number // 执行耗时（毫秒）
}

/**
 * 执行完整流水线
 */
export async function executePipeline(
  idea: string,
  context: PipelineContext,
  options?: PipelineExecuteOptions
): Promise<PipelineResult> {
  const results: Partial<Record<PipelineStep, PipelineStepResult>> = {}
  const startTime = Date.now()

  try {
    // 步骤1: 剧本生成
    results['script-writing'] = await executeStep('script-writing', async () => {
      const result = await writeScriptFromIdea(idea, {
        characters: context.characters,
        modelLog: {
          userId: context.userId,
          projectId: context.projectId,
          op: 'pipeline_write_script'
        }
      })
      return result.script
    })

    if (results['script-writing'].status === 'failed') {
      throw new Error('剧本生成失败: ' + results['script-writing'].error)
    }

    // 步骤2: 智能分集
    const script = results['script-writing'].data as ScriptContent
    results['episode-splitting'] = await executeStep('episode-splitting', async () => {
      return splitIntoEpisodes(script, {
        targetDuration: options?.customOptions?.targetDuration || 60
      })
    })

    if (results['episode-splitting'].status === 'failed') {
      throw new Error('分集失败: ' + results['episode-splitting'].error)
    }

    // 步骤3: 动作提取
    const episodes = results['episode-splitting'].data as EpisodePlan[]
    results['action-extraction'] = await executeStep('action-extraction', async () => {
      return extractActionsFromScenes(script.scenes, context.characters)
    })

    if (results['action-extraction'].status === 'failed') {
      throw new Error('动作提取失败: ' + results['action-extraction'].error)
    }

    // 步骤3.5: 素材匹配
    const sceneActions = results['action-extraction'].data as SceneActions[]
    const projectAssets = [
      ...convertCharacterImagesToAssets(context.characterImages),
      ...context.projectAssets
    ]

    results['asset-matching'] = await executeStep('asset-matching', async () => {
      return matchAssetsForScenes(script.scenes, projectAssets, sceneActions)
    })

    if (results['asset-matching'].status === 'failed') {
      throw new Error('素材匹配失败: ' + results['asset-matching'].error)
    }

    // 步骤4: 分镜生成
    const assetRecommendations = results['asset-matching'].data as SceneAssetRecommendation[]
    results['storyboard-generation'] = await executeStep('storyboard-generation', async () => {
      const allSegments: StoryboardSegment[] = []

      for (const episode of episodes) {
        const segments = generateStoryboard(episode, script.scenes, assetRecommendations, {
          defaultAspectRatio: options?.customOptions?.defaultAspectRatio || '9:16'
        })
        allSegments.push(...segments)
      }

      return allSegments
    })

    if (results['storyboard-generation'].status === 'failed') {
      throw new Error('分镜生成失败: ' + results['storyboard-generation'].error)
    }

    // 步骤5: Seedance 参数化
    const storyboard = results['storyboard-generation'].data as StoryboardSegment[]
    results['seedance-parametrization'] = await executeStep(
      'seedance-parametrization',
      async () => {
        const configs = buildSeedanceConfigs(storyboard, {
          defaultResolution: options?.customOptions?.defaultResolution || '720p',
          defaultAspectRatio: options?.customOptions?.defaultAspectRatio || '9:16'
        })

        // 验证配置
        for (const config of configs) {
          const validation = validateSeedanceConfig(config)
          if (!validation.valid) {
            console.warn(`配置验证警告: ${validation.errors.join(', ')}`)
          }
        }

        return configs
      }
    )

    if (results['seedance-parametrization'].status === 'failed') {
      throw new Error('Seedance参数化失败: ' + results['seedance-parametrization'].error)
    }

    // 汇总结果
    const totalDuration = Date.now() - startTime
    console.log(`流水线执行完成，总耗时: ${totalDuration}ms`)

    return {
      script,
      episodes,
      sceneActions,
      assetRecommendations,
      storyboard,
      seedanceConfigs: results['seedance-parametrization'].data as
        | SeedanceSegmentConfig[]
        | undefined
    }
  } catch (error) {
    console.error('流水线执行失败:', error)
    throw error
  }
}

/**
 * 执行单个步骤
 */
async function executeStep(
  step: PipelineStep,
  fn: () => Promise<any>
): Promise<PipelineStepResult> {
  const startTime = Date.now()

  try {
    console.log(`开始执行步骤: ${step}`)
    const data = await fn()
    const duration = Date.now() - startTime
    console.log(`步骤完成: ${step}，耗时: ${duration}ms`)

    return {
      step,
      status: 'completed',
      data,
      duration
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`步骤失败: ${step}，耗时: ${duration}ms，错误: ${errorMessage}`)

    return {
      step,
      status: 'failed',
      error: errorMessage,
      duration
    }
  }
}

/**
 * 执行指定步骤（用于断点续传）
 */
export async function executeSingleStep(
  step: PipelineStep,
  previousResults: Partial<PipelineResult>,
  context: PipelineContext,
  options?: PipelineExecuteOptions
): Promise<PipelineStepResult> {
  switch (step) {
    case 'script-writing':
      // 需要从头开始，需要 idea，这里不支持
      return {
        step,
        status: 'failed',
        error: 'script-writing 步骤需要原始 idea，无法单独执行'
      }

    case 'episode-splitting':
      if (!previousResults.script) {
        return { step, status: 'failed', error: '缺少 script 数据' }
      }
      return executeStep(step, () => Promise.resolve(splitIntoEpisodes(previousResults.script!)))

    case 'action-extraction':
      if (!previousResults.script) {
        return { step, status: 'failed', error: '缺少 script 数据' }
      }
      return executeStep(step, () =>
        Promise.resolve(
          extractActionsFromScenes(previousResults.script!.scenes, context.characters)
        )
      )

    case 'asset-matching':
      if (!previousResults.script || !previousResults.sceneActions) {
        return { step, status: 'failed', error: '缺少必要数据' }
      }
      const projectAssets = [
        ...convertCharacterImagesToAssets(context.characterImages),
        ...context.projectAssets
      ]
      return executeStep(step, () =>
        Promise.resolve(
          matchAssetsForScenes(
            previousResults.script!.scenes,
            projectAssets,
            previousResults.sceneActions
          )
        )
      )

    case 'storyboard-generation':
      if (!previousResults.episodes || !previousResults.assetRecommendations) {
        return { step, status: 'failed', error: '缺少必要数据' }
      }
      return executeStep(step, () => {
        const allSegments: StoryboardSegment[] = []
        for (const episode of previousResults.episodes!) {
          const segments = generateStoryboard(
            episode,
            previousResults.script!.scenes,
            previousResults.assetRecommendations,
            {
              defaultAspectRatio: options?.customOptions?.defaultAspectRatio || '9:16'
            }
          )
          allSegments.push(...segments)
        }
        return Promise.resolve(allSegments)
      })

    case 'seedance-parametrization':
      if (!previousResults.storyboard) {
        return { step, status: 'failed', error: '缺少 storyboard 数据' }
      }
      return executeStep(step, () =>
        Promise.resolve(buildSeedanceConfigs(previousResults.storyboard!))
      )

    default:
      return { step, status: 'failed', error: `未知步骤: ${step}` }
  }
}

/**
 * 获取流水线状态描述
 */
export function getStepDescription(step: PipelineStep): string {
  const descriptions: Record<PipelineStep, string> = {
    'script-writing': '剧本生成 - 使用 DeepSeek AI 从想法生成专业剧本',
    'episode-splitting': '智能分集 - 将剧本按起承转合结构分割成多集',
    'action-extraction': '动作提取 - 从场景中提取角色动作和情绪',
    'asset-matching': '素材匹配 - 为场景匹配合适的参考图和素材',
    'storyboard-generation': '分镜生成 - 生成带提示词的分镜片段',
    'seedance-parametrization': 'Seedance参数化 - 转换为 Seedance API 参数',
    'video-generation': '视频生成 - 调用 Seedance/Wan API 生成视频'
  }

  return descriptions[step] || '未知步骤'
}

/**
 * 获取流水线步骤顺序
 */
export function getPipelineSteps(): PipelineStep[] {
  return [
    'script-writing',
    'episode-splitting',
    'action-extraction',
    'asset-matching',
    'storyboard-generation',
    'seedance-parametrization',
    'video-generation'
  ]
}

/**
 * 估算流水线总成本
 */
export function estimatePipelineCost(
  script: ScriptContent,
  seedanceConfigs: SeedanceSegmentConfig[]
): {
  scriptCost: number
  videoCost: number
  totalCost: number
} {
  // 剧本成本（简化估算）
  const scriptCost = script.scenes.length * 0.1

  // 视频成本
  const videoCost = seedanceConfigs.reduce((sum, config) => {
    return sum + config.duration * 1.0 // ¥1/秒
  }, 0)

  return {
    scriptCost,
    videoCost,
    totalCost: scriptCost + videoCost
  }
}
