/**
 * 混合模式：部分忠实解析、部分扩展、部分 AI 创作
 */

import type { EpisodeCompleteness } from './script-mode-detector.js'
import type { ModelCallLogContext } from './ai/model-call-log.js'
import { projectRepository } from '../repositories/project-repository.js'
import { formatScriptToJSON, expandEpisodeFromOutline } from './script-writer.js'
import { safeExtractAndSaveMemories } from './memory/index.js'
import { updateJob } from './script-job-helpers.js'

export async function runMixedMode(
  jobId: string,
  projectId: string,
  _targetEpisodes: number,
  episodes: EpisodeCompleteness[],
  embedded: boolean,
  modelLogCtx: ModelCallLogContext
) {
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) return

  const synopsis = project.synopsis || ''

  // 分组处理
  const faithfulEpisodes = episodes.filter((ep) => ep.mode === 'faithful-parse')
  const expandEpisodes = episodes.filter((ep) => ep.mode === 'expand')
  const createEpisodes = episodes.filter((ep) => ep.mode === 'ai-create')

  let completed = 0
  const total = episodes.length

  // 阶段 1：忠实解析
  for (const ep of faithfulEpisodes) {
    if (!ep.content) continue
    completed++

    await updateJob(jobId, {
      progress: Math.round((completed / total) * 100),
      progressMeta: { message: `忠实解析第 ${ep.episodeNum} 集...` }
    })

    const script = await formatScriptToJSON(ep.content, modelLogCtx)
    const episode = await projectRepository.upsertEpisodeBatchFromScript(
      projectId,
      ep.episodeNum,
      script
    )

    await safeExtractAndSaveMemories(projectId, ep.episodeNum, episode.id, script, modelLogCtx)
  }

  // 阶段 2：扩展生成
  for (const ep of expandEpisodes) {
    if (!ep.content) continue
    completed++

    await updateJob(jobId, {
      progress: Math.round((completed / total) * 100),
      progressMeta: { message: `扩展生成第 ${ep.episodeNum} 集...` }
    })

    const script = await expandEpisodeFromOutline(
      ep.episodeNum,
      project.name,
      synopsis,
      ep.content,
      modelLogCtx
    )

    const episode = await projectRepository.upsertEpisodeBatchFromScript(
      projectId,
      ep.episodeNum,
      script
    )

    await safeExtractAndSaveMemories(projectId, ep.episodeNum, episode.id, script, modelLogCtx)
  }

  // 阶段 3：AI 创作（使用三阶段）
  if (createEpisodes.length > 0) {
    console.log(`[mixed] 剩余 ${createEpisodes.length} 集使用 AI 创作`)
    // TODO: 调用原有的三阶段生成逻辑，但只生成 createEpisodes 中的集数
    // 这里简化处理：标记为需要后续处理
    await updateJob(jobId, {
      progressMeta: {
        message: `已完成 ${completed} 集，剩余 ${createEpisodes.length} 集需要 AI 创作`
      }
    })
  }

  // 混合模式下 embedded 参数保留接口兼容，暂未使用
  void embedded

  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    progressMeta: { message: `混合模式完成，共处理 ${completed}/${total} 集` }
  })
}
