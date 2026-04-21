/**
 * Faithful-parse mode: format a complete script without changing content.
 */

import type { EpisodeCompleteness } from './script-mode-detector.js'
import { projectRepository } from '../repositories/project-repository.js'
import { formatScriptToJSON } from './script-writer.js'
import { safeExtractAndSaveMemories } from './memory/index.js'
import { updateJob } from './script-job-helpers.js'
import { mapBatchProgressToParseRange } from './progress-mappers.js'

/** Default project name returned when parsing fails to extract one. */
const DEFAULT_PROJECT_NAME = '未命名项目'

export async function runFaithfulParse(
  jobId: string,
  projectId: string,
  _targetEpisodes: number,
  episodes: EpisodeCompleteness[],
  embedded: boolean
) {
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) return

  // Extract and update project name from script content
  try {
    console.log('[faithful-parse] 正在从剧本中提取项目名称...')
    const firstEpisodeContent = episodes.find((episode) => episode.content)?.content ?? ''

    const { parseScriptDocument } = await import('./ai/parser.js')
    const { parsed } = await parseScriptDocument(firstEpisodeContent, 'markdown', {
      userId: project.userId,
      projectId,
      op: 'extract_project_name_from_complete_script'
    })

    if (parsed.projectName && parsed.projectName !== DEFAULT_PROJECT_NAME) {
      await projectRepository.update(projectId, { name: parsed.projectName })
      console.log(`[faithful-parse] 项目名已更新: ${parsed.projectName}`)
    }
  } catch (error) {
    // Extraction failure is non-fatal; continue with the existing project name
    console.warn('[faithful-parse] 项目名提取失败，使用原有项目名:', error)
  }

  const totalEpisodes = episodes.length
  let completed = 0

  for (const episode of episodes) {
    if (!episode.content) continue

    completed++
    const rawPercentage = Math.round((completed / totalEpisodes) * 100)
    const progress = embedded ? mapBatchProgressToParseRange(rawPercentage) : rawPercentage

    await updateJob(jobId, {
      progress,
      progressMeta: {
        current: completed,
        total: totalEpisodes,
        message: `忠实解析第 ${episode.episodeNum}/${totalEpisodes} 集...`
      }
    })

    console.log(`[faithful-parse] 格式化第 ${episode.episodeNum} 集...`)

    const script = await formatScriptToJSON(episode.content, {
      userId: project.userId,
      projectId,
      op: 'faithful_parse_format'
    })

    const episodeRecord = await projectRepository.upsertEpisodeBatchFromScript(
      projectId,
      episode.episodeNum,
      script
    )

    await safeExtractAndSaveMemories(projectId, episode.episodeNum, episodeRecord.id, script, {
      userId: project.userId,
      projectId,
      op: 'extract_faithful_parse_memories'
    })
  }

  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    progressMeta: { message: `忠实解析完成，共 ${totalEpisodes} 集` }
  })
}
