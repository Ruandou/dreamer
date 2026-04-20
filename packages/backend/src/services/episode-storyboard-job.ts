import type { Prisma } from '@prisma/client'
import { hasEpisodeContentForStoryboard } from './ai/deepseek.js'
import { episodeService, type ExpandEpisodeResult } from './episode-service.js'
import { episodeRepository } from '../repositories/episode-repository.js'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { pipelineQueue } from '../queues/pipeline.js'

function expandFailureMessage(r: Extract<ExpandEpisodeResult, { ok: false }>): string {
  return 'message' in r && r.message ? r.message : r.error
}

export const EPISODE_STORYBOARD_SCRIPT_JOB_TYPE = 'episode-storyboard-script' as const

export type EnqueueEpisodeStoryboardResult =
  | { ok: true; jobId: string }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 400; error: string; message?: string }
  | { ok: false; status: 409; error: string }
  | { ok: false; status: 500; error: string }

/**
 * 创建 PipelineJob 并在当前进程内异步执行（与 parse-script / script-batch 一致，非独立 worker 进程）。
 */
export async function enqueueEpisodeStoryboardScriptJob(
  userId: string,
  episodeId: string,
  hint?: string | null
): Promise<EnqueueEpisodeStoryboardResult> {
  const episode = await episodeRepository.findUnique(episodeId)
  if (!episode) {
    return { ok: false, status: 404, error: 'Episode not found' }
  }

  if (!hasEpisodeContentForStoryboard(episode)) {
    return {
      ok: false,
      status: 400,
      error: '内容不足',
      message: '请先填写本集梗概，或导入/保存含场次或梗概字段的剧本'
    }
  }

  if (
    await pipelineRepository.hasCompletedEpisodeStoryboardScriptJob(episode.projectId, episodeId)
  ) {
    return {
      ok: false,
      status: 409,
      error: '本集已使用 AI 生成分镜脚本，仅支持操作一次'
    }
  }

  const n = await pipelineRepository.countActiveEpisodeStoryboardScriptJobs(
    episode.projectId,
    episodeId
  )
  if (n > 0) {
    return {
      ok: false,
      status: 409,
      error: '该集已有进行中的分镜剧本生成任务，请稍后再试'
    }
  }

  try {
    const job = await pipelineRepository.createPipelineJob({
      projectId: episode.projectId,
      status: 'pending',
      jobType: EPISODE_STORYBOARD_SCRIPT_JOB_TYPE,
      currentStep: EPISODE_STORYBOARD_SCRIPT_JOB_TYPE,
      progress: 0,
      progressMeta: {
        episodeId,
        episodeNum: episode.episodeNum
      } as Prisma.InputJsonValue
    })

    await pipelineQueue.add('episode-storyboard-script', {
      jobId: job.id,
      jobType: 'episode-storyboard-script',
      projectId: episode.projectId,
      userId,
      episodeId,
      hint
    })

    return { ok: true, jobId: job.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, status: 500, error: msg || '创建任务失败' }
  }
}

export async function runEpisodeStoryboardPipelineJob(
  jobId: string,
  userId: string,
  episodeId: string,
  hint?: string | null
): Promise<void> {
  const episode = await episodeRepository.findUnique(episodeId)
  const metaBase: Record<string, unknown> = episode
    ? { episodeId, episodeNum: episode.episodeNum }
    : { episodeId }

  await pipelineRepository.updateJob(jobId, {
    status: 'running',
    progress: 5,
    currentStep: EPISODE_STORYBOARD_SCRIPT_JOB_TYPE,
    progressMeta: metaBase as Prisma.InputJsonValue
  })

  const result = await episodeService.generateEpisodeStoryboardScript(userId, episodeId, hint)

  if (!result.ok) {
    await pipelineRepository.updateJob(jobId, {
      status: 'failed',
      error: expandFailureMessage(result),
      progressMeta: metaBase as Prisma.InputJsonValue
    })
    return
  }

  await pipelineRepository.updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: EPISODE_STORYBOARD_SCRIPT_JOB_TYPE,
    progressMeta: {
      ...metaBase,
      scenesCreated: result.scenesCreated,
      aiCost: result.aiCost
    } as Prisma.InputJsonValue
  })
}
