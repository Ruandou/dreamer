/**
 * Pipeline Job 处理策略
 * 将不同 jobType 的处理逻辑注册为策略，遵循开闭原则
 */

import { executePipelineJob } from '../services/pipeline-executor.js'
import {
  runGenerateFirstEpisodePipelineJob,
  runScriptBatchJob,
  runParseScriptJob
} from '../services/project-script-jobs.js'
import { runEpisodeStoryboardPipelineJob } from '../services/episode-storyboard-job.js'

export interface PipelineJobData {
  jobId: string
  jobType: string
  projectId: string
  userId?: string
  idea?: string
  targetEpisodes?: number
  targetDuration?: number
  defaultAspectRatio?: string
  defaultResolution?: string
  episodeId?: string
  hint?: string | null
  options?: Record<string, unknown>
}

export type PipelineJobHandler = (data: PipelineJobData) => Promise<void>

/** Pipeline Job 处理策略映射表 */
export const PIPELINE_JOB_HANDLERS: Record<string, PipelineJobHandler> = {
  'full-pipeline': async (data) => {
    if (!data.idea) throw new Error('full-pipeline 缺少 idea 参数')
    await executePipelineJob(data.jobId, {
      projectId: data.projectId,
      idea: data.idea,
      targetEpisodes: data.targetEpisodes,
      targetDuration: data.targetDuration,
      defaultAspectRatio: (data.defaultAspectRatio ?? '9:16') as '9:16' | '16:9' | '1:1',
      defaultResolution: (data.defaultResolution ?? '720p') as '720p' | '480p'
    })
  },

  'script-first': async (data) => {
    await runGenerateFirstEpisodePipelineJob(data.jobId, data.projectId)
  },

  'script-batch': async (data) => {
    const targetEpisodes = data.targetEpisodes ?? 36
    await runScriptBatchJob(data.jobId, data.projectId, targetEpisodes, data.options)
  },

  'parse-script': async (data) => {
    const targetEpisodes = data.targetEpisodes ?? 36
    await runParseScriptJob(data.jobId, data.projectId, targetEpisodes)
  },

  'episode-storyboard-script': async (data) => {
    if (!data.userId) throw new Error('episode-storyboard-script 缺少 userId')
    if (!data.episodeId) throw new Error('episode-storyboard-script 缺少 episodeId')
    await runEpisodeStoryboardPipelineJob(data.jobId, data.userId, data.episodeId, data.hint)
  }
}

/**
 * 获取 Job 处理器
 */
export function getPipelineJobHandler(jobType: string): PipelineJobHandler {
  const handler = PIPELINE_JOB_HANDLERS[jobType]
  if (!handler) {
    const availableTypes = Object.keys(PIPELINE_JOB_HANDLERS).join(', ')
    throw new Error(`未知的 Pipeline jobType: ${jobType}. 可用类型: ${availableTypes}`)
  }
  return handler
}

/**
 * 注册新的 Job 处理器（支持扩展）
 */
export function registerPipelineJobHandler(jobType: string, handler: PipelineJobHandler): void {
  PIPELINE_JOB_HANDLERS[jobType] = handler
}
