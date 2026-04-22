/**
 * Mixed mode: faithful-parse some episodes, expand others, AI-create the rest.
 */

import type { EpisodeCompleteness } from './script-mode-detector.js'
import type { ModelCallLogContext } from './ai/model-call-log.js'
import { projectRepository } from '../repositories/project-repository.js'
import { formatScriptToJSON, expandEpisodeFromOutline } from './script-writer.js'
import { safeExtractAndSaveMemories } from './memory/index.js'
import { updateJob } from './script-job-helpers.js'
import { logInfo } from '../lib/error-logger.js'

export async function runMixedMode(
  jobId: string,
  projectId: string,
  _targetEpisodes: number,
  episodes: EpisodeCompleteness[],
  embedded: boolean,
  modelLogContext: ModelCallLogContext
) {
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) return

  const synopsis = project.synopsis ?? ''

  // Group episodes by processing mode
  const faithfulEpisodes = episodes.filter((episode) => episode.mode === 'faithful-parse')
  const expandEpisodes = episodes.filter((episode) => episode.mode === 'expand')
  const createEpisodes = episodes.filter((episode) => episode.mode === 'ai-create')

  let completed = 0
  const total = episodes.length

  // Phase 1: faithful parse
  for (const episode of faithfulEpisodes) {
    if (!episode.content) continue
    completed++

    await updateJob(jobId, {
      progress: Math.round((completed / total) * 100),
      progressMeta: { message: `忠实解析第 ${episode.episodeNum} 集...` }
    })

    const script = await formatScriptToJSON(episode.content, modelLogContext)
    const episodeRecord = await projectRepository.upsertEpisodeBatchFromScript(
      projectId,
      episode.episodeNum,
      script
    )

    await safeExtractAndSaveMemories(
      projectId,
      episode.episodeNum,
      episodeRecord.id,
      script,
      modelLogContext
    )
  }

  // Phase 2: expand from outline
  for (const episode of expandEpisodes) {
    if (!episode.content) continue
    completed++

    await updateJob(jobId, {
      progress: Math.round((completed / total) * 100),
      progressMeta: { message: `扩展生成第 ${episode.episodeNum} 集...` }
    })

    const script = await expandEpisodeFromOutline(
      episode.episodeNum,
      project.name,
      synopsis,
      episode.content,
      modelLogContext
    )

    const episodeRecord = await projectRepository.upsertEpisodeBatchFromScript(
      projectId,
      episode.episodeNum,
      script
    )

    await safeExtractAndSaveMemories(
      projectId,
      episode.episodeNum,
      episodeRecord.id,
      script,
      modelLogContext
    )
  }

  // Phase 3: AI creation (placeholder – full three-phase logic not yet implemented for subsets)
  if (createEpisodes.length > 0) {
    logInfo('MixedMode', '剩余集使用 AI 创作', { count: createEpisodes.length })
    await updateJob(jobId, {
      progressMeta: {
        message: `已完成 ${completed} 集，剩余 ${createEpisodes.length} 集需要 AI 创作`
      }
    })
  }

  // `embedded` kept for interface compatibility; not used in mixed mode yet
  void embedded

  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    progressMeta: { message: `混合模式完成，共处理 ${completed}/${total} 集` }
  })
}
