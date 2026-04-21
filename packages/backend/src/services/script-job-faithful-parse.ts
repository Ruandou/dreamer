/**
 * 忠实解析模式：格式化完整剧本，不改变内容
 */

import type { EpisodeCompleteness } from './script-mode-detector.js'
import { projectRepository } from '../repositories/project-repository.js'
import { formatScriptToJSON } from './script-writer.js'
import { safeExtractAndSaveMemories } from './memory/index.js'
import { updateJob, mapBatchProgressToParseRange } from './script-job-helpers.js'

export async function runFaithfulParse(
  jobId: string,
  projectId: string,
  _targetEpisodes: number,
  episodes: EpisodeCompleteness[],
  embedded: boolean
) {
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) return

  // 从剧本内容中提取并更新项目名
  try {
    console.log('[faithful-parse] 正在从剧本中提取项目名称...')
    const firstEpisodeContent = episodes.find((ep) => ep.content)?.content || ''

    // 使用 AI 解析器提取项目名（只需要 projectName 字段）
    const { parseScriptDocument } = await import('./ai/parser.js')
    const { parsed } = await parseScriptDocument(firstEpisodeContent, 'markdown', {
      userId: project.userId,
      projectId,
      op: 'extract_project_name_from_complete_script'
    })

    if (parsed.projectName && parsed.projectName !== '未命名项目') {
      await projectRepository.update(projectId, {
        name: parsed.projectName
      })
      console.log(`[faithful-parse] 项目名已更新: ${parsed.projectName}`)
    }
  } catch (error) {
    // 提取失败不影响后续流程，使用原有项目名
    console.warn('[faithful-parse] 项目名提取失败，使用原有项目名:', error)
  }

  const totalEpisodes = episodes.length
  let completed = 0

  for (const ep of episodes) {
    if (!ep.content) continue

    completed++
    const progress = embedded
      ? mapBatchProgressToParseRange(Math.round((completed / totalEpisodes) * 100))
      : Math.round((completed / totalEpisodes) * 100)

    await updateJob(jobId, {
      progress,
      progressMeta: {
        current: completed,
        total: totalEpisodes,
        message: `忠实解析第 ${ep.episodeNum}/${totalEpisodes} 集...`
      }
    })

    console.log(`[faithful-parse] 格式化第 ${ep.episodeNum} 集...`)

    // 格式化为 JSON
    const script = await formatScriptToJSON(ep.content, {
      userId: project.userId,
      projectId,
      op: 'faithful_parse_format'
    })

    // 保存到数据库
    const episode = await projectRepository.upsertEpisodeBatchFromScript(
      projectId,
      ep.episodeNum,
      script
    )

    // 提取记忆
    await safeExtractAndSaveMemories(projectId, ep.episodeNum, episode.id, script, {
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
