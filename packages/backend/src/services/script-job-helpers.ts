/**
 * 大纲页 Job 共享工具函数
 * 包含：Job 更新、剧本 JSON 解析、进度计算、上下文构建
 */

import { Prisma } from '@prisma/client'
import type { ScriptContent, ScriptScene, EpisodePlan } from '@dreamer/shared/types'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { projectRepository } from '../repositories/project-repository.js'
import {
  STORY_CONTEXT_MAX_LENGTH,
  SYNOPSIS_SLICE_LENGTH,
  ESTIMATED_SECONDS_PER_SCENE,
  FUTURE_OUTLINE_LOOKAHEAD
} from './project-script-jobs.constants.js'

// ── Job 进度更新 ──

export async function updateJob(
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

  await pipelineRepository.updateJob(jobId, payload)
}

// ── 剧本 JSON 工具 ──

/** 将分集 `Episode.script` 转为 ScriptContent（无效则 null） */
export function scriptFromJson(raw: unknown): ScriptContent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.scenes)) return null
  return raw as ScriptContent
}

/** 判断 1..targetEpisodes 是否均有有效剧本 JSON（`Episode.script`） */
export function areEpisodeScriptsComplete(
  episodes: { episodeNum: number; script: unknown }[],
  targetEpisodes: number
): boolean {
  for (let n = 1; n <= targetEpisodes; n++) {
    const ep = episodes.find((e) => e.episodeNum === n)
    if (!ep || !scriptFromJson(ep.script)) return false
  }
  return true
}

/** 从已落库分集构建 EpisodePlan（sceneIndices 指向 mergeEpisodesToScriptContent 后的全局 scenes 下标） */
export function buildEpisodePlansFromDbEpisodes(
  episodes: {
    episodeNum: number
    title: string | null
    synopsis: string | null
    script: unknown
  }[],
  merged: ScriptContent
): EpisodePlan[] {
  const ordered = [...episodes].sort((a, b) => a.episodeNum - b.episodeNum)
  let offset = 0
  const plans: EpisodePlan[] = []
  for (const ep of ordered) {
    const sc = scriptFromJson(ep.script)
    if (!sc) continue
    const len = sc.scenes.length
    plans.push({
      episodeNum: ep.episodeNum,
      title: ep.title || `${merged.title} 第${ep.episodeNum}集`,
      synopsis: ep.synopsis || sc.summary || '',
      sceneCount: len,
      estimatedDuration: len * ESTIMATED_SECONDS_PER_SCENE,
      keyMoments: [],
      sceneIndices: Array.from({ length: len }, (_, i) => offset + i)
    })
    offset += len
  }
  return plans
}

/** 合并多集剧本 JSON 为单一 ScriptContent（供实体提取 / 分镜等） */
export function mergeEpisodesToScriptContent(
  episodes: { episodeNum: number; title: string | null; script: unknown }[]
): ScriptContent {
  const ordered = [...episodes].sort((a, b) => a.episodeNum - b.episodeNum)
  const allScenes: ScriptScene[] = []
  let baseTitle = '剧本'
  let baseSummary = ''

  for (const ep of ordered) {
    const sc = scriptFromJson(ep.script)
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

/** 填充空缺的分集简介 */
export async function fillEpisodeSynopses(projectId: string) {
  const episodes = await projectRepository.findManyEpisodesOrdered(projectId)
  for (const ep of episodes) {
    if (ep.synopsis?.trim()) continue
    const sc = scriptFromJson(ep.script)
    if (!sc) continue
    const synopsis =
      sc.summary?.trim() ||
      sc.scenes[0]?.description?.slice(0, SYNOPSIS_SLICE_LENGTH) ||
      `第${ep.episodeNum}集`
    await projectRepository.updateEpisodeSynopsis(ep.id, synopsis)
  }
}

// ── 上下文构建 ──

/** 构建增强上下文：记忆 + 未来大纲参考 */
export function buildEnhancedContext(memoryContext: string, futureOutlines: string[]): string {
  const parts = [memoryContext]

  if (futureOutlines.length > 0) {
    parts.push('\n【后续剧情走向参考】')
    parts.push(futureOutlines.join('\n\n'))
    parts.push('\n注意：请确保本集剧情与后续发展自然衔接，埋下必要的伏笔。')
  }

  return parts.join('\n')
}

/** 获取未来 N 集的大纲 */
export function getFutureOutlines(
  allOutlines: Map<number, string>,
  currentEpisode: number,
  lookahead: number = FUTURE_OUTLINE_LOOKAHEAD
): string[] {
  const futures: string[] = []
  for (let i = 1; i <= lookahead; i++) {
    const epNum = currentEpisode + i
    const outline = allOutlines.get(epNum)
    if (outline) {
      futures.push(`第${epNum}集大纲：${outline}`)
    }
  }
  return futures
}

// ── 进度计算 ──

/** 将批量进度百分比映射到 parse 嵌入模式的 8–28% 区间 */
export function mapBatchProgressToParseRange(batchPct: number): number {
  return Math.min(28, 8 + Math.round((Math.min(100, batchPct) / 100) * 20))
}

/** 计算剧本集进度百分比 */
export function calcEpisodePct(current: number, total: number): number {
  return Math.round(((current - 1) / Math.max(1, total - 1)) * 100)
}

/** 三阶段模式下的进度映射：20% 起步，95% 封顶 */
export function mapThreePhaseProgress(pct: number): number {
  return 20 + Math.round((pct / 100) * 75)
}

/** 旧版串行模式下的进度映射 */
export function mapLegacyProgress(pct: number): number {
  return Math.min(99, pct)
}

/** 截取故事上下文到最大长度 */
export function sliceStoryContext(context: string): string {
  return context.slice(-STORY_CONTEXT_MAX_LENGTH)
}
