/**
 * Shared helpers for outline-page PipelineJobs.
 *
 * Responsibilities:
 * - Job progress updates
 * - Script JSON parsing / validation
 * - Context building (memory + future outlines)
 * - Episode plan construction
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

// ── Job progress updates ──

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

// ── Script JSON utilities ──

/**
 * Parse an `Episode.script` JSON blob into a typed `ScriptContent`.
 *
 * @returns Parsed content, or `null` if the raw value is not a valid script object.
 */
export function scriptFromJson(raw: unknown): ScriptContent | null {
  if (!raw || typeof raw !== 'object') return null
  const object = raw as Record<string, unknown>
  if (!Array.isArray(object.scenes)) return null
  return raw as ScriptContent
}

/**
 * Check whether every episode from 1 to `targetEpisodes` has a valid script JSON.
 */
export function areEpisodeScriptsComplete(
  episodes: { episodeNum: number; script: unknown }[],
  targetEpisodes: number
): boolean {
  for (let episodeNumber = 1; episodeNumber <= targetEpisodes; episodeNumber++) {
    const episode = episodes.find((e) => e.episodeNum === episodeNumber)
    if (!episode || !scriptFromJson(episode.script)) return false
  }
  return true
}

/**
 * Build `EpisodePlan` objects from persisted episodes.
 *
 * `sceneIndices` point into the global scene list produced by `mergeEpisodesToScriptContent`.
 */
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
  for (const episode of ordered) {
    const scriptContent = scriptFromJson(episode.script)
    if (!scriptContent) continue
    const sceneCount = scriptContent.scenes.length
    plans.push({
      episodeNum: episode.episodeNum,
      title: episode.title || `${merged.title} 第${episode.episodeNum}集`,
      synopsis: episode.synopsis || scriptContent.summary || '',
      sceneCount,
      estimatedDuration: sceneCount * ESTIMATED_SECONDS_PER_SCENE,
      keyMoments: [],
      sceneIndices: Array.from({ length: sceneCount }, (_, index) => offset + index)
    })
    offset += sceneCount
  }
  return plans
}

/**
 * Merge multiple episode scripts into a single `ScriptContent`.
 *
 * Used for entity extraction and storyboard generation.
 */
export function mergeEpisodesToScriptContent(
  episodes: { episodeNum: number; title: string | null; script: unknown }[]
): ScriptContent {
  const ordered = [...episodes].sort((a, b) => a.episodeNum - b.episodeNum)
  const allScenes: ScriptScene[] = []
  let baseTitle = '剧本'
  let baseSummary = ''

  for (const episode of ordered) {
    const scriptContent = scriptFromJson(episode.script)
    if (!scriptContent) continue
    if (episode.episodeNum === 1) {
      baseTitle = scriptContent.title || episode.title || baseTitle
      baseSummary = scriptContent.summary || baseSummary
    }
    const offset = allScenes.length
    scriptContent.scenes.forEach((scene, index) => {
      allScenes.push({
        ...scene,
        sceneNum: offset + index + 1
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

/**
 * Fill missing episode synopses by falling back to script summary or first scene description.
 */
export async function fillEpisodeSynopses(projectId: string) {
  const episodes = await projectRepository.findManyEpisodesOrdered(projectId)
  for (const episode of episodes) {
    if (episode.synopsis?.trim()) continue
    const scriptContent = scriptFromJson(episode.script)
    if (!scriptContent) continue
    const synopsis =
      scriptContent.summary?.trim() ||
      scriptContent.scenes[0]?.description?.slice(0, SYNOPSIS_SLICE_LENGTH) ||
      `第${episode.episodeNum}集`
    await projectRepository.updateEpisodeSynopsis(episode.id, synopsis)
  }
}

// ── Context building ──

/**
 * Build an enhanced writing context that blends memory with future-outline hints.
 *
 * Why: giving the model visibility into upcoming episodes improves narrative
 * consistency and foreshadowing.
 */
export function buildEnhancedContext(memoryContext: string, futureOutlines: string[]): string {
  const parts = [memoryContext]

  if (futureOutlines.length > 0) {
    parts.push('\n【后续剧情走向参考】')
    parts.push(futureOutlines.join('\n\n'))
    parts.push('\n注意：请确保本集剧情与后续发展自然衔接，埋下必要的伏笔。')
  }

  return parts.join('\n')
}

/**
 * Retrieve outlines for the next N episodes.
 */
export function getFutureOutlines(
  allOutlines: Map<number, string>,
  currentEpisode: number,
  lookahead: number = FUTURE_OUTLINE_LOOKAHEAD
): string[] {
  const futures: string[] = []
  for (let offset = 1; offset <= lookahead; offset++) {
    const episodeNumber = currentEpisode + offset
    const outline = allOutlines.get(episodeNumber)
    if (outline) {
      futures.push(`第${episodeNumber}集大纲：${outline}`)
    }
  }
  return futures
}

// ── Story-context slicing ──

/**
 * Truncate story context to the maximum allowed length.
 *
 * Why slice from the end: recent context is more relevant for continuity.
 */
export function sliceStoryContext(context: string): string {
  return context.slice(-STORY_CONTEXT_MAX_LENGTH)
}
