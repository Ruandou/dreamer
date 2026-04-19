/**
 * Pipeline 执行器 - 异步 Job 模式
 * 负责在后台执行 Pipeline 各步骤并更新 Job 状态
 */

import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { writeScriptFromIdea } from './script-writer.js'
import { splitIntoEpisodes } from './episode-splitter.js'
import { extractActionsFromScenes } from './action-extractor.js'
import { generateStoryboard } from './storyboard-generator.js'
import {
  areEpisodeScriptsComplete,
  buildEpisodePlansFromDbEpisodes,
  DEFAULT_TARGET_EPISODES
} from './project-script-jobs.js'
import { runParseScriptEntityPipeline } from './parse-script-entity-pipeline.js'
import { applyScriptVisualEnrichment } from './script-visual-enrich.js'

import type { ScriptContent, EpisodePlan, StoryboardSegment } from '@dreamer/shared/types'

interface PipelineJobOptions {
  projectId: string
  idea: string
  targetEpisodes?: number
  targetDuration?: number
  defaultAspectRatio: '16:9' | '9:16' | '1:1'
  defaultResolution: '480p' | '720p'
}

/**
 * 更新 Job 进度
 */
async function updateJobProgress(
  jobId: string,
  update: {
    status?: string
    currentStep?: string
    progress?: number
    error?: string
  }
) {
  await pipelineRepository.updateJob(jobId, update)
}

/**
 * 更新步骤结果
 */
async function updateStepResult(
  jobId: string,
  step: string,
  update: {
    status?: string
    input?: unknown
    output?: unknown
    error?: string
  }
) {
  await pipelineRepository.updateStepResult(jobId, step, update)
}

/**
 * 执行 Pipeline Job
 */
export async function executePipelineJob(jobId: string, options: PipelineJobOptions) {
  const { projectId, idea, targetEpisodes, targetDuration, defaultAspectRatio } = options

  console.log(`Starting Pipeline Job ${jobId} for project ${projectId}`)

  try {
    // 更新状态为运行中
    await updateJobProgress(jobId, {
      status: 'running',
      currentStep: 'script-writing',
      progress: 5
    })

    const projectMeta = await pipelineRepository.findProjectUserId(projectId)

    const te = targetEpisodes && targetEpisodes > 0 ? targetEpisodes : DEFAULT_TARGET_EPISODES
    const existingEpisodes = await pipelineRepository.findEpisodesUpTo(projectId, te)
    const skipEarlySteps =
      existingEpisodes.length >= te && areEpisodeScriptsComplete(existingEpisodes, te)

    let script: ScriptContent
    let episodes: EpisodePlan[]

    if (skipEarlySteps) {
      // ========== 已具备全部分集剧本 JSON：跳过 AI 写剧与智能分集 ==========
      await updateStepResult(jobId, 'script-writing', {
        status: 'completed',
        input: { idea },
        output: { skipped: true, reason: 'episodes_already_have_script' }
      })
      await updateJobProgress(jobId, { progress: 25 })

      if (!projectMeta?.userId) {
        throw new Error('流水线缺少项目用户，无法执行角色身份合并')
      }
      script = await runParseScriptEntityPipeline(projectId, projectMeta.userId, te)

      const episodesForPlan = await pipelineRepository.findEpisodesUpTo(projectId, te)
      await updateStepProgress(jobId, 'episode-split', 'processing')
      episodes = buildEpisodePlansFromDbEpisodes(episodesForPlan, script)
      await updateStepResult(jobId, 'episode-split', {
        status: 'completed',
        output: { episodes, skipped: true }
      })
      await updateJobProgress(jobId, { currentStep: 'episode-split', progress: 45 })
    } else {
      // ========== 步骤 1: 剧本生成 ==========
      await updateStepResult(jobId, 'script-writing', { status: 'processing', input: { idea } })

      const scriptResult = await writeScriptFromIdea(idea, {
        characters: [], // TODO: 传入已有角色
        modelLog: projectMeta
          ? { userId: projectMeta.userId, projectId, op: 'pipeline_job_write_script' }
          : undefined
      })

      script = scriptResult.script
      await updateStepResult(jobId, 'script-writing', {
        status: 'completed',
        output: { script }
      })
      await updateJobProgress(jobId, { progress: 25 })

      // ========== 步骤 2: 智能分集 ==========
      await updateStepProgress(jobId, 'episode-split', 'processing')

      episodes = splitIntoEpisodes(script, {
        targetDuration: targetDuration || 60
      })

      await pipelineRepository.saveEpisodes(projectId, episodes, script)
      await updateStepResult(jobId, 'episode-split', {
        status: 'completed',
        output: { episodes }
      })
      await updateJobProgress(jobId, { currentStep: 'episode-split', progress: 45 })

      if (!projectMeta?.userId) {
        throw new Error('流水线缺少项目用户，无法执行角色身份合并')
      }
      script = await runParseScriptEntityPipeline(projectId, projectMeta.userId, te)
    }

    // 与「解析剧本」一致：落库场地/角色后生成定场图与定妆提示词（此前仅 parse-script 会调，流水线缺这一段导致有场地无 imagePrompt）
    await applyScriptVisualEnrichment(projectId, script)

    // ========== 步骤 3: 分镜提取 ==========
    await updateStepResult(jobId, 'segment-extract', { status: 'processing' })

    const sceneActions = extractActionsFromScenes(script.scenes, [])
    await updateStepResult(jobId, 'segment-extract', {
      status: 'completed',
      output: { sceneActions }
    })
    await updateJobProgress(jobId, { currentStep: 'segment-extract', progress: 65 })

    // ========== 步骤 4: 分镜生成 ==========
    await updateStepResult(jobId, 'storyboard', { status: 'processing' })

    await pipelineRepository.findLocationsActive(projectId)

    // 生成 storyboard
    const allSegments: StoryboardSegment[] = []
    for (const episode of episodes) {
      const segments = generateStoryboard(
        episode,
        script.scenes,
        [], // assetRecommendations
        { defaultAspectRatio }
      )
      allSegments.push(...segments)
    }

    // 保存分镜到数据库
    await pipelineRepository.saveSegments(projectId, episodes, allSegments, script.scenes)

    await updateStepResult(jobId, 'storyboard', {
      status: 'completed',
      output: { storyboard: allSegments }
    })
    await updateJobProgress(jobId, { currentStep: 'storyboard', progress: 90 })

    // ========== 完成 ==========
    await updateJobProgress(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed'
    })

    console.log(`Pipeline Job ${jobId} completed successfully`)
  } catch (error) {
    console.error(`Pipeline Job ${jobId} failed:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await updateJobProgress(jobId, {
      status: 'failed',
      error: errorMessage
    })

    // 更新当前步骤为失败
    await updateStepResult(jobId, 'unknown', {
      status: 'failed',
      error: errorMessage
    })
  }
}

async function updateStepProgress(jobId: string, step: string, status: string) {
  await updateStepResult(jobId, step, { status })
}
