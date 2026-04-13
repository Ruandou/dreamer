/**
 * 大纲页：生成第一集 / 批量剩余集 / 解析剧本（异步 Job 实现）
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../index.js'
import { writeScriptFromIdea, writeEpisodeForProject } from './script-writer.js'
import { saveCharacters, saveLocations } from './script-entities.js'
import type { ScriptContent, ScriptScene, EpisodePlan } from '@dreamer/shared/types'

export const DEFAULT_TARGET_EPISODES = 36

/** 与大纲页互斥的异步任务类型（批量剧本 / 解析剧本） */
const OUTLINE_ASYNC_JOB_TYPES = ['script-batch', 'parse-script'] as const

/**
 * 是否存在进行中的批量剧本或解析任务，用于避免与另一路并发写同一项目。
 */
export async function hasConcurrentOutlinePipelineJob(projectId: string): Promise<boolean> {
  const n = await prisma.pipelineJob.count({
    where: {
      projectId,
      status: { in: ['pending', 'running'] },
      jobType: { in: [...OUTLINE_ASYNC_JOB_TYPES] }
    }
  })
  return n > 0
}

/** 当前进行中的大纲页异步任务（批量 / 解析），用于前端刷新后恢复状态 */
export async function getActiveOutlinePipelineJob(projectId: string) {
  return prisma.pipelineJob.findFirst({
    where: {
      projectId,
      status: { in: ['pending', 'running'] },
      jobType: { in: [...OUTLINE_ASYNC_JOB_TYPES] }
    },
    orderBy: { createdAt: 'desc' }
  })
}

function scriptFromJson(raw: unknown): ScriptContent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray((o as any).scenes)) return null
  return raw as ScriptContent
}

/** 判断 1..targetEpisodes 是否均有有效 rawScript */
export function areEpisodeScriptsComplete(
  episodes: { episodeNum: number; rawScript: unknown }[],
  targetEpisodes: number
): boolean {
  for (let n = 1; n <= targetEpisodes; n++) {
    const ep = episodes.find(e => e.episodeNum === n)
    if (!ep || !scriptFromJson(ep.rawScript)) return false
  }
  return true
}

/** 从已落库分集构建 EpisodePlan（sceneIndices 指向 mergeEpisodesToScriptContent 后的全局 scenes 下标） */
export function buildEpisodePlansFromDbEpisodes(
  episodes: { episodeNum: number; title: string | null; synopsis: string | null; rawScript: unknown }[],
  merged: ScriptContent
): EpisodePlan[] {
  const ordered = [...episodes].sort((a, b) => a.episodeNum - b.episodeNum)
  let offset = 0
  const plans: EpisodePlan[] = []
  for (const ep of ordered) {
    const sc = scriptFromJson(ep.rawScript)
    if (!sc) continue
    const len = sc.scenes.length
    plans.push({
      episodeNum: ep.episodeNum,
      title: ep.title || `${merged.title} 第${ep.episodeNum}集`,
      synopsis: ep.synopsis || sc.summary || '',
      sceneCount: len,
      estimatedDuration: len * 12,
      keyMoments: [],
      sceneIndices: Array.from({ length: len }, (_, i) => offset + i)
    })
    offset += len
  }
  return plans
}

async function updateJob(
  jobId: string,
  data: {
    status?: string
    currentStep?: string
    progress?: number
    progressMeta?: object | null
    error?: string | null
  }
) {
  const payload: Prisma.PipelineJobUpdateInput = {}
  if (data.status !== undefined) payload.status = data.status
  if (data.currentStep !== undefined) payload.currentStep = data.currentStep
  if (data.progress !== undefined) payload.progress = data.progress
  if (data.error !== undefined) payload.error = data.error
  if (data.progressMeta !== undefined) {
    payload.progressMeta =
      data.progressMeta === null ? Prisma.JsonNull : (data.progressMeta as Prisma.InputJsonValue)
  }

  await prisma.pipelineJob.update({
    where: { id: jobId },
    data: payload
  })
}

/** 合并多集 rawScript 为单一 ScriptContent（供实体提取 / 分镜等） */
export function mergeEpisodesToScriptContent(
  episodes: { episodeNum: number; title: string | null; rawScript: unknown }[]
): ScriptContent {
  const ordered = [...episodes].sort((a, b) => a.episodeNum - b.episodeNum)
  const allScenes: ScriptScene[] = []
  let baseTitle = '剧本'
  let baseSummary = ''

  for (const ep of ordered) {
    const sc = scriptFromJson(ep.rawScript)
    if (!sc) continue
    if (ep.episodeNum === 1) {
      baseTitle = sc.title || ep.title || baseTitle
      baseSummary = sc.summary || baseSummary
    }
    const offset = allScenes.length
    sc.scenes.forEach((scene, i) => {
      allScenes.push({
        ...scene,
        sceneNum: offset + i + 1
      })
    })
  }

  return {
    title: baseTitle,
    summary: baseSummary,
    metadata: {},
    scenes: allScenes
  }
}

async function ensureCharacterBaseSlot(projectId: string, script: ScriptContent) {
  await saveCharacters(projectId, script)
  const characters = await prisma.character.findMany({ where: { projectId } })
  for (const c of characters) {
    const existing = await prisma.characterImage.findFirst({
      where: { characterId: c.id, type: 'base' }
    })
    if (existing) continue
    await prisma.characterImage.create({
      data: {
        characterId: c.id,
        name: '默认形象',
        type: 'base',
        avatarUrl: null,
        order: 0
      }
    })
  }
}

async function fillEpisodeSynopses(projectId: string) {
  const episodes = await prisma.episode.findMany({
    where: { projectId },
    orderBy: { episodeNum: 'asc' }
  })
  for (const ep of episodes) {
    if (ep.synopsis?.trim()) continue
    const sc = scriptFromJson(ep.rawScript)
    if (!sc) continue
    const synopsis =
      sc.summary?.trim() ||
      sc.scenes[0]?.description?.slice(0, 200) ||
      `第${ep.episodeNum}集`
    await prisma.episode.update({
      where: { id: ep.id },
      data: { synopsis }
    })
  }
}

export async function runGenerateFirstEpisode(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('PROJECT_NOT_FOUND')

  const idea = project.description?.trim() || project.name
  const { script } = await writeScriptFromIdea(idea)

  const storyContext = [project.synopsis || script.summary, script.summary].filter(Boolean).join('\n').slice(0, 12000)

  await prisma.project.update({
    where: { id: projectId },
    data: {
      synopsis: script.summary,
      storyContext
    }
  })

  await prisma.episode.upsert({
    where: { projectId_episodeNum: { projectId, episodeNum: 1 } },
    update: {
      title: script.title,
      rawScript: script as object
    },
    create: {
      projectId,
      episodeNum: 1,
      title: script.title,
      rawScript: script as object
    }
  })
}

export async function runScriptBatchJob(jobId: string, projectId: string, targetEpisodes: number) {
  await updateJob(jobId, { status: 'running', currentStep: 'script-batch', progress: 0 })

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { episodes: { orderBy: { episodeNum: 'asc' } } }
  })
  if (!project) {
    await updateJob(jobId, { status: 'failed', error: '项目不存在' })
    return
  }

  const synopsis = project.synopsis || ''
  let rolling = project.storyContext || synopsis

  try {
    for (let n = 2; n <= targetEpisodes; n++) {
      const existing = await prisma.episode.findUnique({
        where: { projectId_episodeNum: { projectId, episodeNum: n } }
      })
      if (existing && scriptFromJson(existing.rawScript)) {
        const pct = Math.round(((n - 1) / Math.max(1, targetEpisodes - 1)) * 100)
        await updateJob(jobId, {
          progress: Math.min(99, pct),
          progressMeta: { current: n, total: targetEpisodes, message: `第 ${n} 集已存在，跳过` }
        })
        continue
      }

      const { script } = await writeEpisodeForProject(n, synopsis, rolling, project.name)

      await prisma.episode.upsert({
        where: { projectId_episodeNum: { projectId, episodeNum: n } },
        update: {
          title: script.title,
          synopsis: script.summary,
          rawScript: script as object
        },
        create: {
          projectId,
          episodeNum: n,
          title: script.title,
          synopsis: script.summary,
          rawScript: script as object
        }
      })

      rolling = [rolling, `第${n}集：${script.summary}`].join('\n').slice(-12000)
      await prisma.project.update({
        where: { id: projectId },
        data: { storyContext: rolling }
      })

      const pct = Math.round(((n - 1) / Math.max(1, targetEpisodes - 1)) * 100)
      await updateJob(jobId, {
        progress: Math.min(99, pct),
        progressMeta: {
          current: n,
          total: targetEpisodes,
          message: `正在生成第 ${n}/${targetEpisodes} 集`
        }
      })
    }

    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      progressMeta: { current: targetEpisodes, total: targetEpisodes, message: '批量剧本已完成' }
    })
  } catch (e: any) {
    await updateJob(jobId, {
      status: 'failed',
      error: e?.message || '批量生成失败',
      progressMeta: { message: e?.message }
    })
  }
}

/** 补全缺失集 rawScript（在解析前调用） */
export async function ensureAllEpisodeScripts(projectId: string, targetEpisodes: number) {
  const ep1 = await prisma.episode.findUnique({
    where: { projectId_episodeNum: { projectId, episodeNum: 1 } }
  })
  if (!ep1 || !scriptFromJson(ep1.rawScript)) {
    await runGenerateFirstEpisode(projectId)
  }

  let needBatch = false
  for (let n = 2; n <= targetEpisodes; n++) {
    const ep = await prisma.episode.findUnique({
      where: { projectId_episodeNum: { projectId, episodeNum: n } }
    })
    if (!ep || !scriptFromJson(ep.rawScript)) {
      needBatch = true
      break
    }
  }
  if (!needBatch) return

  const job = await prisma.pipelineJob.create({
    data: {
      projectId,
      status: 'running',
      jobType: 'script-batch',
      currentStep: 'script-batch',
      progress: 0
    }
  })
  try {
    await runScriptBatchJob(job.id, projectId, targetEpisodes)
  } finally {
    const j = await prisma.pipelineJob.findUnique({ where: { id: job.id } })
    if (j?.status === 'running') {
      await prisma.pipelineJob.update({
        where: { id: job.id },
        data: { status: 'completed', progress: 100 }
      })
    }
  }
}

export async function runParseScriptJob(jobId: string, projectId: string, targetEpisodes: number) {
  await updateJob(jobId, { status: 'running', currentStep: 'parse-script', progress: 5 })

  try {
    await ensureAllEpisodeScripts(projectId, targetEpisodes)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { episodes: { orderBy: { episodeNum: 'asc' } } }
    })
    if (!project) {
      await updateJob(jobId, { status: 'failed', error: '项目不存在' })
      return
    }

    const ep1 = project.episodes.find(e => e.episodeNum === 1)
    if (!scriptFromJson(ep1?.rawScript)) {
      await updateJob(jobId, { status: 'failed', error: '第一集剧本不存在' })
      return
    }

    await updateJob(jobId, { progress: 30, progressMeta: { message: '提取角色与场景…' } })

    const capped = project.episodes.filter((e) => e.episodeNum <= targetEpisodes)
    const merged = mergeEpisodesToScriptContent(capped as any)
    await saveLocations(projectId, merged)
    await ensureCharacterBaseSlot(projectId, merged)
    await fillEpisodeSynopses(projectId)

    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      progressMeta: { message: '解析完成' }
    })
  } catch (e: any) {
    await updateJob(jobId, {
      status: 'failed',
      error: e?.message || '解析失败',
      progressMeta: { message: e?.message }
    })
  }
}
