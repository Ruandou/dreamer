/**
 * 大纲页：生成第一集 / 批量剩余集 / 解析剧本（异步 Job 实现）
 *
 * 编排层：调度 script-mode-detector、script-job-helpers、
 * script-job-faithful-parse、script-job-mixed-mode 等子模块。
 */

import { Prisma } from '@prisma/client'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { projectRepository } from '../repositories/project-repository.js'
import { recordModelApiCall } from './ai/api-logger.js'
import { generateVisualStyleConfig } from './ai/visual-style-generator.js'
import { writeScriptFromIdea, formatScriptToJSON } from './script-writer.js'
import { applyScriptVisualEnrichment } from './script-visual-enrich.js'
import { runParseScriptEntityPipeline } from './parse-script-entity-pipeline.js'

// 从拆分后的模块导入
export {
  scriptFromJson,
  areEpisodeScriptsComplete,
  buildEpisodePlansFromDbEpisodes,
  mergeEpisodesToScriptContent
} from './script-job-helpers.js'
export {
  detectScriptMode,
  calculateOverallScore,
  detectEpisodesMode
} from './script-mode-detector.js'
export type { EpisodeProcessingMode, EpisodeCompleteness } from './script-mode-detector.js'
export { DEFAULT_TARGET_EPISODES } from './project-script-jobs.constants.js'

import { updateJob, scriptFromJson } from './script-job-helpers.js'
import { detectScriptMode } from './script-mode-detector.js'
import { runFaithfulParse } from './script-job-faithful-parse.js'
import { runMixedMode } from './script-job-mixed-mode.js'
import { safeExtractAndSaveMemories } from './memory/index.js'
import { withTimeout, timeoutErrorMessage } from '../lib/with-timeout.js'
import { runAiCreationThreePhase, runAiCreationLegacy } from './script-job-ai-creation.js'
import {
  VISUAL_ENRICHMENT_TIMEOUT_MS,
  STORY_CONTEXT_MAX_LENGTH
} from './project-script-jobs.constants.js'

/**
 * 是否存在进行中的批量剧本或解析任务，用于避免与另一路并发写同一项目。
 */
export async function hasConcurrentOutlinePipelineJob(projectId: string): Promise<boolean> {
  const n = await pipelineRepository.countOutlineAsyncJobs(projectId)
  return n > 0
}

/**
 * 当前进行中的大纲页异步任务（第一集 / 批量 / 解析），用于前端刷新后恢复状态。
 * 优先返回 parse-script，再 script-batch，再 script-first，避免误取非解析任务。
 */
export async function getActiveOutlinePipelineJob(projectId: string) {
  return pipelineRepository.getActiveOutlinePipelineJob(projectId)
}

export { generateAllOutlines } from './script-job-ai-creation.js'

export async function runGenerateFirstEpisode(projectId: string, targetEpisodes?: number) {
  const project = await projectRepository.findUniqueById(projectId)
  if (!project) throw new Error('PROJECT_NOT_FOUND')

  const idea = project.description?.trim() || project.name

  // 检测是否为完整剧本
  const detectionResult = detectScriptMode(project.description || '')

  if (detectionResult.mode === 'faithful-parse') {
    // 完整剧本 → 解析所有集
    console.log('[generate-first] 检测到完整剧本，解析所有集')
    await projectRepository.update(projectId, {
      synopsis: project.description,
      storyContext: (project.description || '').slice(0, STORY_CONTEXT_MAX_LENGTH)
    })

    const allEpisodes = detectionResult.episodes || []
    // 尊重 targetEpisodes 限制
    const maxEp = targetEpisodes ?? allEpisodes.length
    const episodesToParse = allEpisodes.filter((ep) => ep.episodeNum <= maxEp)

    console.log(
      `[generate-first] 将解析 ${episodesToParse.length}/${allEpisodes.length} 集（目标：${maxEp}）`
    )

    let parsedCount = 0
    let failedCount = 0

    for (const ep of episodesToParse) {
      if (!ep.content) continue

      try {
        console.log(`[generate-first] 解析第 ${ep.episodeNum} 集...`)
        const script = await formatScriptToJSON(ep.content, {
          userId: project.userId,
          projectId,
          op: 'parse_all_episodes_from_complete_script'
        })

        const episode = await projectRepository.upsertEpisodeBatchFromScript(
          projectId,
          ep.episodeNum,
          script
        )

        await safeExtractAndSaveMemories(projectId, ep.episodeNum, episode.id, script, {
          userId: project.userId,
          projectId,
          op: 'extract_complete_script_memories'
        })

        parsedCount++
        console.log(
          `[generate-first] 第 ${ep.episodeNum} 集解析完成 (${parsedCount}/${episodesToParse.length})`
        )
      } catch (error) {
        failedCount++
        console.error(`[generate-first] 第 ${ep.episodeNum} 集解析失败:`, error)
        // 继续处理下一集，不因单集失败而中断
      }
    }

    console.log(
      `[generate-first] 完整剧本解析完成：成功 ${parsedCount} 集，失败 ${failedCount} 集，共 ${episodesToParse.length} 集`
    )

    if (parsedCount === 0) {
      throw new Error('完整剧本解析失败，未能成功解析任何集')
    }

    return
  }

  if (detectionResult.mode === 'mixed') {
    // 混合模式 → 只创建第一集，其余交给 script-batch
    console.log('[generate-first] 检测到混合模式，创建第一集')
    await projectRepository.update(projectId, {
      synopsis: project.description,
      storyContext: (project.description || '').slice(0, STORY_CONTEXT_MAX_LENGTH)
    })

    const episodes = detectionResult.episodes
    if (!episodes) {
      console.log('[generate-first] 混合模式缺少 episodes 数据')
      return
    }

    const ep1 = episodes.find((e) => e.episodeNum === 1)
    if (ep1?.content) {
      const script = await formatScriptToJSON(ep1.content, {
        userId: project.userId,
        projectId,
        op: 'parse_first_episode_mixed'
      })
      const episode = await projectRepository.upsertEpisodeFirstFromScript(projectId, script)
      console.log(`[generate-first] 混合模式第一集已创建: episodeId=${episode.id}`)
    } else {
      // 第一集内容缺失，由后续 script-batch 的 AI 创作流程处理
      console.log('[generate-first] 混合模式第一集内容缺失，将由 script-batch 处理')
    }
    return
  }

  // 创意 → 正常AI生成
  const { script } = await writeScriptFromIdea(idea, {
    modelLog: {
      userId: project.userId,
      projectId,
      op: 'generate_first_episode'
    }
  })

  const storyContext = [project.synopsis || script.summary, script.summary]
    .filter(Boolean)
    .join('\n')
    .slice(0, STORY_CONTEXT_MAX_LENGTH)

  await projectRepository.update(projectId, {
    synopsis: script.summary,
    storyContext
  })

  const episode = await projectRepository.upsertEpisodeFirstFromScript(projectId, script)

  // 提取第一集的记忆
  await safeExtractAndSaveMemories(projectId, 1, episode.id, script, {
    userId: project.userId,
    projectId,
    op: 'extract_first_episode_memories'
  })
}

/**
 * 将「生成第一集」绑定到 PipelineJob（互斥与刷新恢复）。
 * 仅由 `POST .../episodes/generate-first` 调用；`ensureAllEpisodeScripts` 内请直接调 `runGenerateFirstEpisode`。
 */
export async function runGenerateFirstEpisodePipelineJob(
  jobId: string,
  projectId: string,
  targetEpisodes?: number
) {
  await updateJob(jobId, {
    status: 'running',
    currentStep: 'script-first',
    progress: 5
  })
  try {
    await runGenerateFirstEpisode(projectId, targetEpisodes)
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      progressMeta: { message: '第一集已生成' }
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '生成第一集失败'
    await updateJob(jobId, {
      status: 'failed',
      error: message,
      progressMeta: { message }
    })
    throw e
  }
}

export type RunScriptBatchJobOptions = {
  /** 嵌入「解析剧本」任务：不另建 script-batch，进度写在同一 job 上，且结束时保持 running 供后续解析步骤 */
  embeddedInParse?: boolean
  /** 是否使用三阶段生成（大纲→审核→剧本），默认 true */
  useThreePhase?: boolean
}

export async function runScriptBatchJob(
  jobId: string,
  projectId: string,
  targetEpisodes: number,
  opts?: RunScriptBatchJobOptions
) {
  const embedded = Boolean(opts?.embeddedInParse)
  const useThreePhase = opts?.useThreePhase !== false // 默认启用三阶段

  if (embedded) {
    await updateJob(jobId, {
      status: 'running',
      currentStep: 'parse-script',
      progress: 8,
      progressMeta: { message: '补全或批量生成剩余剧集…' }
    })
  } else {
    await updateJob(jobId, {
      status: 'running',
      currentStep: 'outline-generation',
      progress: 0
    })
  }

  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) {
    await updateJob(jobId, { status: 'failed', error: '项目不存在' })
    throw new Error('项目不存在')
  }

  const synopsis = project.synopsis || ''
  const modelLogCtx = {
    userId: project.userId,
    projectId,
    op: 'script_batch_generation'
  }

  try {
    // ====== 智能模式检测 ======
    console.log(`[script-batch] 开始检测剧本模式, projectId=${projectId}`)
    const detectionResult = detectScriptMode(synopsis)
    console.log(`[script-batch] 检测结果: ${detectionResult.mode}`)

    // 记录决策结果到 Job progressMeta
    const decisionDetails: Record<string, unknown> = {
      mode: detectionResult.mode,
      detectedAt: new Date().toISOString(),
      synopsisLength: synopsis.length
    }

    // 如果是逐集检测，添加详细信息
    if (detectionResult.episodes) {
      decisionDetails.episodeCount = detectionResult.episodes.length
      decisionDetails.episodeModes = detectionResult.episodes.map((ep) => ({
        episodeNum: ep.episodeNum,
        mode: ep.mode,
        confidence: ep.confidence
      }))

      // 统计各模式数量
      const modeCounts: Record<string, number> = {}
      detectionResult.episodes.forEach((ep) => {
        modeCounts[ep.mode] = (modeCounts[ep.mode] || 0) + 1
      })
      decisionDetails.modeDistribution = modeCounts
    }

    await updateJob(jobId, {
      progressMeta: {
        message: `检测到剧本模式: ${detectionResult.mode}`,
        scriptModeDecision: decisionDetails
      }
    })

    console.log('[script-batch] 决策详情:', JSON.stringify(decisionDetails, null, 2))

    // 记录决策到 ModelApiCall（审计追溯）
    try {
      await recordModelApiCall({
        userId: project.userId,
        model: 'script-mode-detector',
        provider: 'heuristic',
        prompt: `剧本长度: ${synopsis.length} 字符`,
        requestParams: { op: 'script_mode_detection', projectId },
        responseData: decisionDetails,
        status: 'completed'
      })
    } catch (error) {
      console.error('[script-batch] 记录决策失败:', error)
    }

    // ====== 模式 A：忠实解析完整剧本 ======
    if (detectionResult.mode === 'faithful-parse') {
      console.log('[script-batch] 使用忠实解析模式')
      const episodes = detectionResult.episodes
      if (!episodes) {
        throw new Error('忠实解析模式缺少 episodes 数据')
      }
      await runFaithfulParse(jobId, projectId, targetEpisodes, episodes, embedded)
      return
    }

    // ====== 模式 B：混合模式 ======
    if (detectionResult.mode === 'mixed') {
      console.log('[script-batch] 使用混合模式')
      const episodes = detectionResult.episodes
      if (!episodes) {
        throw new Error('混合模式缺少 episodes 数据')
      }
      await runMixedMode(jobId, projectId, targetEpisodes, episodes, embedded, modelLogCtx)
      return
    }

    // ====== 模式 C：AI 创作 ======
    const aiCreationCtx = {
      jobId,
      projectId,
      targetEpisodes,
      project: { userId: project.userId, name: project.name, storyContext: project.storyContext },
      synopsis,
      embedded,
      modelLogCtx
    }

    if (useThreePhase) {
      await runAiCreationThreePhase(aiCreationCtx)
    } else {
      await runAiCreationLegacy(aiCreationCtx)
    }

    if (embedded) {
      await updateJob(jobId, {
        status: 'running',
        currentStep: 'parse-script',
        progress: 28,
        progressMeta: {
          current: targetEpisodes,
          total: targetEpisodes,
          message: '剧集已齐备，继续解析…'
        }
      })
    } else {
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'completed',
        progressMeta: {
          current: targetEpisodes,
          total: targetEpisodes,
          message: '批量剧本已完成'
        }
      })
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '批量生成失败'
    console.error('[script-batch] 任务执行失败:', {
      jobId,
      projectId,
      error: message,
      stack: e instanceof Error ? e.stack : undefined
    })

    await updateJob(jobId, {
      status: 'failed',
      error: message,
      progressMeta: { message }
    })
    // 重新抛出错误，让调用方知道失败了
    throw e
  }
}

/**
 * 补全缺失集剧本（在解析前调用）。
 * @param reusePipelineJobId 若传入（通常为当前 parse-script 的 jobId），则不再新建 script-batch，把批量进度写到同一任务上，避免前端优先展示 parse 时长期卡在 5%。
 */
export async function ensureAllEpisodeScripts(
  projectId: string,
  targetEpisodes: number,
  reusePipelineJobId?: string
) {
  const ep1 = await projectRepository.findEpisodeByProjectNum(projectId, 1)
  if (!ep1 || !scriptFromJson(ep1.script)) {
    await runGenerateFirstEpisode(projectId, targetEpisodes)
    if (reusePipelineJobId) {
      await updateJob(reusePipelineJobId, {
        progress: 7,
        progressMeta: { message: '已补全第一集，检查其余剧集…' }
      })
    }
  }

  // 检查是否已经解析了所有集（完整剧本场景）
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (project) {
    const existingEpisodes = project.episodes.filter(
      (ep) => ep.episodeNum >= 1 && ep.episodeNum <= targetEpisodes && scriptFromJson(ep.script)
    )
    if (existingEpisodes.length >= targetEpisodes) {
      console.log(
        `[ensureAllEpisodeScripts] 已存在 ${existingEpisodes.length}/${targetEpisodes} 集剧本，跳过批量生成`
      )
      return
    }
  }

  // 复用已获取的 project.episodes，避免逐集 N+1 查询
  const episodesMap = new Map(
    (project?.episodes ?? [])
      .filter((e) => e.episodeNum >= 2 && e.episodeNum <= targetEpisodes)
      .map((e) => [e.episodeNum, e])
  )
  let needBatch = false
  for (let n = 2; n <= targetEpisodes; n++) {
    const ep = episodesMap.get(n)
    if (!ep || !scriptFromJson(ep.script)) {
      needBatch = true
      break
    }
  }
  if (!needBatch) return

  if (reusePipelineJobId) {
    await runScriptBatchJob(reusePipelineJobId, projectId, targetEpisodes, {
      embeddedInParse: true
    })
    return
  }

  const job = await pipelineRepository.createPipelineJob({
    projectId,
    status: 'running',
    jobType: 'script-batch',
    currentStep: 'script-batch',
    progress: 0
  })
  try {
    await runScriptBatchJob(job.id, projectId, targetEpisodes)
  } finally {
    const j = await pipelineRepository.findUniqueJob(job.id)
    if (j?.status === 'running') {
      await pipelineRepository.updateJob(job.id, {
        status: 'completed',
        progress: 100
      })
    }
  }
}

export async function runParseScriptJob(jobId: string, projectId: string, targetEpisodes: number) {
  await updateJob(jobId, {
    status: 'running',
    currentStep: 'parse-script',
    progress: 5
  })

  try {
    console.log(
      `[parse-script] 开始解析剧本, projectId=${projectId}, targetEpisodes=${targetEpisodes}`
    )

    await ensureAllEpisodeScripts(projectId, targetEpisodes, jobId)

    const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
    if (!project) {
      await updateJob(jobId, { status: 'failed', error: '项目不存在' })
      throw new Error('项目不存在')
    }

    // 自动生成 visualStyleConfig（如果没有）
    if (!project.visualStyleConfig) {
      console.log('[parse-script] 基于完整梗概自动生成 visualStyleConfig')
      try {
        const config = await generateVisualStyleConfig(
          {
            name: project.name,
            description: project.description,
            synopsis: project.synopsis
          },
          {
            userId: project.userId,
            projectId,
            op: 'auto_generate_visual_style'
          }
        )

        await projectRepository.update(projectId, {
          visualStyleConfig: config as unknown as Prisma.InputJsonValue
        })
        console.log('[parse-script] visualStyleConfig 已生成并保存')
      } catch (error) {
        console.error('[parse-script] 自动生成 visualStyleConfig 失败:', error)
        // 不阻断流程，继续解析
      }
    }

    const ep1 = project.episodes.find((e) => e.episodeNum === 1)
    if (!scriptFromJson(ep1?.script)) {
      await updateJob(jobId, { status: 'failed', error: '第一集剧本不存在' })
      throw new Error('第一集剧本不存在')
    }

    await updateJob(jobId, {
      progress: 30,
      progressMeta: { message: '提取角色与场景…' }
    })

    console.log('[parse-script] 开始执行实体提取Pipeline')
    const merged = await runParseScriptEntityPipeline(projectId, project.userId, targetEpisodes)

    await updateJob(jobId, {
      progress: 60,
      progressMeta: { message: '生成形象与场地提示词…' }
    })

    console.log('[parse-script] 开始应用视觉增强（20分钟超时保护）')
    await withTimeout(
      applyScriptVisualEnrichment(projectId, merged),
      VISUAL_ENRICHMENT_TIMEOUT_MS,
      timeoutErrorMessage('视觉增强', VISUAL_ENRICHMENT_TIMEOUT_MS)
    )

    console.log('[parse-script] 填充分集简介')
    const { fillEpisodeSynopses } = await import('./script-job-helpers.js')
    await fillEpisodeSynopses(projectId)

    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      progressMeta: { message: '解析完成' }
    })

    console.log('[parse-script] 解析任务完成')
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '解析失败'
    console.error('[parse-script] 解析任务失败:', {
      jobId,
      projectId,
      error: message,
      stack: e instanceof Error ? e.stack : undefined
    })

    await updateJob(jobId, {
      status: 'failed',
      error: message,
      progressMeta: { message }
    })

    throw e
  }
}
