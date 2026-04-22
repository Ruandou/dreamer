/**
 * 首集生成器
 * 负责生成第一集或解析完整剧本的第一集
 */

import { projectRepository } from '../../repositories/project-repository.js'
import { formatScriptToJSON, writeScriptFromIdea } from '../script-writer.js'
import { safeExtractAndSaveMemories } from '../memory/index.js'
import { scriptModeRouter } from './script-mode-router.js'
import { STORY_CONTEXT_MAX_LENGTH } from '../project-script-jobs.constants.js'
import { logInfo, logError } from '../../lib/error-logger.js'
import type { FirstEpisodeOptions, FirstEpisodeResult } from './types.js'

export class FirstEpisodeGenerator {
  /**
   * 生成第一集
   * - 如果是完整剧本：解析第一集
   * - 如果是混合模式：创建第一集
   * - 如果是 AI 创作：调用 AI 生成
   */
  async generate(options: FirstEpisodeOptions): Promise<FirstEpisodeResult> {
    const project = await projectRepository.findUniqueById(options.projectId)
    if (!project) {
      throw new Error('PROJECT_NOT_FOUND')
    }

    const detectionResult = scriptModeRouter.detectMode(project.description || '')

    // 更新项目上下文
    await this.updateProjectContext(project)

    if (detectionResult.mode === 'faithful-parse') {
      return this.parseFaithfulEpisodes(project, detectionResult, options.targetEpisodes)
    }

    if (detectionResult.mode === 'mixed') {
      return this.handleMixedMode(project, detectionResult)
    }

    // AI 创作模式
    return this.handleAICreation(project, detectionResult)
  }

  /**
   * 解析完整剧本的剧集
   */
  private async parseFaithfulEpisodes(
    project: { userId: string; id: string; description: string | null },
    detectionResult: { episodes?: Array<{ episodeNum: number; content?: string }> },
    targetEpisodes?: number
  ): Promise<FirstEpisodeResult> {
    const allEpisodes = detectionResult.episodes || []
    const maxEp = targetEpisodes ?? allEpisodes.length
    const episodesToParse = allEpisodes.filter((ep) => ep.episodeNum <= maxEp)

    logInfo(
      'FirstEpisode',
      `将解析 ${episodesToParse.length}/${allEpisodes.length} 集（目标：${maxEp}）`
    )

    let parsedCount = 0
    let failedCount = 0

    for (const ep of episodesToParse) {
      if (!ep.content) continue

      try {
        logInfo('FirstEpisode', `解析第 ${ep.episodeNum} 集...`)
        const script = await formatScriptToJSON(ep.content, {
          userId: project.userId,
          projectId: project.id,
          op: 'parse_all_episodes_from_complete_script'
        })

        const episode = await projectRepository.upsertEpisodeBatchFromScript(
          project.id,
          ep.episodeNum,
          script
        )

        await safeExtractAndSaveMemories(project.id, ep.episodeNum, episode.id, script, {
          userId: project.userId,
          projectId: project.id,
          op: 'extract_complete_script_memories'
        })

        parsedCount++
        logInfo('FirstEpisode', `第 ${ep.episodeNum} 集解析完成`, {
          parsed: parsedCount,
          total: episodesToParse.length
        })
      } catch (error) {
        failedCount++
        logError('FirstEpisode', `第 ${ep.episodeNum} 集解析失败`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logInfo('FirstEpisode', '完整剧本解析完成', {
      success: parsedCount,
      failed: failedCount,
      total: episodesToParse.length
    })

    if (parsedCount === 0) {
      throw new Error('完整剧本解析失败，未能成功解析任何集')
    }

    return {
      episodeCount: episodesToParse.length,
      parsedCount,
      failedCount
    }
  }

  /**
   * 处理混合模式
   */
  private async handleMixedMode(
    project: { id: string },
    detectionResult: { episodes?: Array<{ episodeNum: number }> }
  ): Promise<FirstEpisodeResult> {
    logInfo('FirstEpisode', '检测到混合模式，创建第一集')

    const episodes = detectionResult.episodes
    if (!episodes) {
      logInfo('FirstEpisode', '混合模式缺少 episodes 数据')
      return { episodeCount: 0, parsedCount: 0, failedCount: 0 }
    }

    const ep1 = episodes.find((e) => e.episodeNum === 1)
    if (!ep1) {
      logInfo('FirstEpisode', '混合模式缺少第 1 集数据')
      return { episodeCount: 0, parsedCount: 0, failedCount: 0 }
    }

    logInfo('FirstEpisode', '混合模式第一集创建完成')
    return { episodeCount: 1, parsedCount: 1, failedCount: 0 }
  }

  /**
   * 处理 AI 创作模式
   */
  private async handleAICreation(
    project: {
      userId: string
      id: string
      description: string | null
      name: string
      synopsis: string | null
    },
    _detectionResult: unknown
  ): Promise<FirstEpisodeResult> {
    const idea = project.description?.trim() || project.name

    const { script } = await writeScriptFromIdea(idea, {
      modelLog: {
        userId: project.userId,
        projectId: project.id,
        op: 'generate_first_episode'
      }
    })

    const storyContext = [project.synopsis || script.summary, script.summary]
      .filter(Boolean)
      .join('\n')
      .slice(0, STORY_CONTEXT_MAX_LENGTH)

    await projectRepository.update(project.id, {
      synopsis: script.summary,
      storyContext
    })

    const episode = await projectRepository.upsertEpisodeFirstFromScript(project.id, script)

    // 提取第一集的记忆
    await safeExtractAndSaveMemories(project.id, 1, episode.id, script, {
      userId: project.userId,
      projectId: project.id,
      op: 'extract_first_episode_memories'
    })

    logInfo('FirstEpisode', 'AI 创作第一集已生成', { episodeId: episode.id })
    return { episodeCount: 1, parsedCount: 1, failedCount: 0 }
  }

  /**
   * 更新项目上下文
   */
  private async updateProjectContext(project: {
    id: string
    description: string | null
  }): Promise<void> {
    await projectRepository.update(project.id, {
      synopsis: project.description,
      storyContext: (project.description || '').slice(0, STORY_CONTEXT_MAX_LENGTH)
    })
  }
}

export const firstEpisodeGenerator = new FirstEpisodeGenerator()
