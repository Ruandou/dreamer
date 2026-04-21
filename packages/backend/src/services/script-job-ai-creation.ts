/**
 * AI 创作模式：三阶段生成（大纲 → 审核 → 剧本）
 * 从 project-script-jobs.ts 拆出，专注 AI 创作流程
 */

import type { ModelCallLogContext } from './ai/api-logger.js'
import { projectRepository } from '../repositories/project-repository.js'
import {
  writeEpisodeForProject,
  showrunnerReviewOutlines,
  reviseOutlinesBasedOnFeedback,
  generateEpisodeOutline
} from './script-writer.js'
import { getMemoryService, safeExtractAndSaveMemories } from './memory/index.js'
import {
  updateJob,
  scriptFromJson,
  buildEnhancedContext,
  getFutureOutlines,
  sliceStoryContext
} from './script-job-helpers.js'
import {
  calcEpisodePct,
  mapThreePhaseProgress,
  mapBatchProgressToParseRange,
  mapLegacyProgress
} from './script-jobs/progress-mappers.js'
import { withTimeout, timeoutErrorMessage } from '../lib/with-timeout.js'
import {
  OUTLINE_GENERATION_TIMEOUT_MS,
  SHOWRUNNER_REVIEW_TIMEOUT_MS,
  OUTLINE_MAX_RETRIES,
  OUTLINE_BASE_DELAY_MS,
  OUTLINE_BATCH_CONCURRENCY,
  OUTLINE_MIN_LENGTH,
  MAX_REVISION_ROUNDS
} from './project-script-jobs.constants.js'

/**
 * 分批并行生成所有集的大纲
 */
export async function generateAllOutlines(
  projectId: string,
  targetEpisodes: number,
  seriesTitle: string,
  seriesSynopsis: string,
  concurrency: number = OUTLINE_BATCH_CONCURRENCY,
  modelLogCtx?: { userId: string; projectId: string; op: string }
): Promise<Map<number, string>> {
  const outlines = new Map<number, string>()
  const totalBatches = Math.ceil(targetEpisodes / concurrency)
  let completedBatches = 0

  for (let batchStart = 1; batchStart <= targetEpisodes; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency - 1, targetEpisodes)
    completedBatches++
    const batchProgress = Math.round((completedBatches / totalBatches) * 100)

    console.log(
      `[outline-generation] 生成第 ${batchStart}-${batchEnd} 集大纲... (批次 ${completedBatches}/${totalBatches}, ${batchProgress}%)`
    )

    await Promise.all(
      Array.from({ length: batchEnd - batchStart + 1 }, async (_, i) => {
        const epNum = batchStart + i
        let retries = 0

        while (retries < OUTLINE_MAX_RETRIES) {
          try {
            const outline = await generateEpisodeOutline(
              epNum,
              seriesTitle,
              seriesSynopsis,
              modelLogCtx
            )

            if (!outline || outline.length < OUTLINE_MIN_LENGTH) {
              throw new Error(
                `大纲质量不合格（长度：${outline?.length || 0}，要求至少 ${OUTLINE_MIN_LENGTH} 字）`
              )
            }

            outlines.set(epNum, outline)
            console.log(`[outline-generation] 第 ${epNum} 集大纲生成成功 (${outline.length} 字)`)
            break
          } catch (error) {
            retries++
            if (retries >= OUTLINE_MAX_RETRIES) {
              console.error(
                `[outline-generation] 第 ${epNum} 集大纲生成失败（已重试 ${OUTLINE_MAX_RETRIES} 次）`,
                {
                  projectId,
                  episodeNum: epNum,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  stack: error instanceof Error ? error.stack : undefined
                }
              )
              throw error
            }
            const delay = OUTLINE_BASE_DELAY_MS * Math.pow(2, retries - 1)
            console.log(
              `[outline-generation] 第 ${epNum} 集大纲生成失败，${delay / 1000}秒后重试 (${retries}/${OUTLINE_MAX_RETRIES})...`
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      })
    )
  }

  return outlines
}

interface AiCreationContext {
  jobId: string
  projectId: string
  targetEpisodes: number
  project: {
    userId: string
    name: string
    storyContext?: string | null
  }
  synopsis: string
  embedded: boolean
  modelLogCtx: ModelCallLogContext
}

/**
 * 串行生成剧集的共享逻辑
 * 三阶段和旧版模式共用
 */
async function generateEpisodesSerial(
  ctx: AiCreationContext,
  startEpisode: number,
  allOutlines: Map<number, string> | null,
  progressMapper: (pct: number) => number
): Promise<void> {
  const { jobId, projectId, targetEpisodes, project, synopsis, embedded } = ctx
  const memoryService = getMemoryService()
  let rolling = project.storyContext || synopsis

  for (let n = startEpisode; n <= targetEpisodes; n++) {
    const existing = await projectRepository.findEpisodeByProjectNum(projectId, n)
    if (existing && scriptFromJson(existing.script)) {
      const pct = calcEpisodePct(n, targetEpisodes)
      const progress = embedded ? mapBatchProgressToParseRange(pct) : progressMapper(pct)
      await updateJob(jobId, {
        progress,
        progressMeta: { current: n, total: targetEpisodes, message: `第 ${n} 集已存在，跳过` }
      })
      continue
    }

    console.log(`[script-batch] 开始生成第 ${n}/${targetEpisodes} 集剧本...`)

    // 构建增强上下文：记忆 + 未来大纲（仅三阶段有 allOutlines）
    let episodeContext = rolling
    try {
      const memoryContext = await memoryService.getEpisodeWritingContext(projectId, n)
      if (memoryContext.fullContext && !memoryContext.fullContext.includes('（暂无）')) {
        if (allOutlines) {
          const futureOutlines = getFutureOutlines(allOutlines, n)
          episodeContext = buildEnhancedContext(memoryContext.fullContext, futureOutlines)
        } else {
          episodeContext = memoryContext.fullContext
        }
      }
    } catch (error) {
      console.error('Failed to build memory context, falling back to rolling context:', error)
    }

    const { script } = await writeEpisodeForProject(n, synopsis, episodeContext, project.name, {
      userId: project.userId,
      projectId,
      op: 'script_batch_write_episode'
    })

    const ep = await projectRepository.upsertEpisodeBatchFromScript(projectId, n, script)

    rolling = sliceStoryContext([rolling, `第${n}集：${script.summary}`].join('\n'))
    await projectRepository.update(projectId, { storyContext: rolling })

    // 提取记忆
    await safeExtractAndSaveMemories(projectId, n, ep.id, script, {
      userId: project.userId,
      projectId,
      op: 'extract_episode_memories'
    })

    const pct = calcEpisodePct(n, targetEpisodes)
    const progress = embedded ? mapBatchProgressToParseRange(pct) : progressMapper(pct)
    await updateJob(jobId, {
      progress,
      progressMeta: {
        current: n,
        total: targetEpisodes,
        message: `正在生成第 ${n}/${targetEpisodes} 集`
      }
    })

    console.log(`[script-batch] 第 ${n}/${targetEpisodes} 集生成完成`)
  }
}

/**
 * 三阶段 AI 创作模式：大纲 → 审核 → 剧本
 */
export async function runAiCreationThreePhase(ctx: AiCreationContext): Promise<void> {
  const { jobId, projectId, targetEpisodes, project, synopsis, modelLogCtx } = ctx

  console.log('[script-batch] 开始三阶段生成：大纲 → 审核 → 剧本')

  // 阶段 1：并行生成所有大纲
  await updateJob(jobId, {
    currentStep: 'outline-generation',
    progress: 5,
    progressMeta: { message: '正在生成所有集的大纲...' }
  })

  console.log('[script-batch] 阶段 1：开始生成大纲（30分钟超时保护）')
  let allOutlines = await withTimeout(
    generateAllOutlines(
      projectId,
      targetEpisodes,
      project.name,
      synopsis,
      undefined,
      modelLogCtx as { userId: string; projectId: string; op: string }
    ),
    OUTLINE_GENERATION_TIMEOUT_MS,
    timeoutErrorMessage('大纲生成', OUTLINE_GENERATION_TIMEOUT_MS)
  )
  console.log(`[script-batch] 阶段 1 完成：已生成 ${allOutlines.size} 集大纲`)

  // 阶段 2：AI 总编剧审核大纲
  await updateJob(jobId, {
    currentStep: 'showrunner-review',
    progress: 15,
    progressMeta: { message: 'AI 总编剧审核大纲一致性...' }
  })

  console.log('[script-batch] 阶段 2：开始 AI 总编剧审核（15分钟超时保护）...')
  let review = await withTimeout(
    showrunnerReviewOutlines(synopsis, allOutlines, modelLogCtx),
    SHOWRUNNER_REVIEW_TIMEOUT_MS,
    timeoutErrorMessage('总编剧审核', SHOWRUNNER_REVIEW_TIMEOUT_MS)
  )

  let revisionRound = 0
  while (!review.approved && revisionRound < MAX_REVISION_ROUNDS) {
    revisionRound++
    console.log(`[showrunner] 审核未通过，开始第 ${revisionRound} 轮自动修正...`)

    await updateJob(jobId, {
      progressMeta: {
        message: `审核发现问题，正在进行第 ${revisionRound} 轮自动修正...`,
        reviewFeedback: review.feedback.substring(0, 500)
      }
    })

    allOutlines = await reviseOutlinesBasedOnFeedback(
      synopsis,
      allOutlines,
      review.feedback,
      modelLogCtx
    )
    console.log(`[showrunner] 第 ${revisionRound} 轮修正完成，重新审核...`)
    review = await showrunnerReviewOutlines(synopsis, allOutlines, modelLogCtx)

    if (review.approved) {
      console.log('[showrunner] 大纲审核通过 ✅')
      break
    }
  }

  if (review.approved) {
    console.log('[script-batch] 大纲审核通过，进入阶段 3')
  } else {
    console.log('[script-batch] ⚠️ 2 轮修正后仍有问题，但仍继续生成')
    console.log('[script-batch] 审核意见：', review.feedback.substring(0, 200))
  }

  // 阶段 3：基于大纲串行生成完整剧本
  await updateJob(jobId, {
    currentStep: 'script-generation',
    progress: 20,
    progressMeta: { message: '基于审核通过的大纲生成完整剧本...' }
  })

  await generateEpisodesSerial(ctx, 1, allOutlines, mapThreePhaseProgress)
}

/**
 * 旧版串行生成（兼容模式）
 */
export async function runAiCreationLegacy(ctx: AiCreationContext): Promise<void> {
  console.log('[script-batch] 使用旧版串行生成模式')
  await generateEpisodesSerial(ctx, 2, null, mapLegacyProgress)
}
