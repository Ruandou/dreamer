/**
 * 大纲页：生成第一集 / 批量剩余集 / 解析剧本（异步 Job 实现）
 */

import { Prisma } from '@prisma/client'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { projectRepository } from '../repositories/project-repository.js'
import { recordModelApiCall } from './ai/api-logger.js'
import { generateVisualStyleConfig } from './ai/visual-style-generator.js'
import {
  writeScriptFromIdea,
  writeEpisodeForProject,
  generateEpisodeOutline,
  showrunnerReviewOutlines,
  formatScriptToJSON,
  expandEpisodeFromOutline,
  reviseOutlinesBasedOnFeedback
} from './script-writer.js'
import { applyScriptVisualEnrichment } from './script-visual-enrich.js'
import { runParseScriptEntityPipeline } from './parse-script-entity-pipeline.js'
import { getMemoryService } from './memory/index.js'
import type { ScriptContent, ScriptScene, EpisodePlan } from '@dreamer/shared/types'

export const DEFAULT_TARGET_EPISODES = 36

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

/** 将分集 `Episode.script` 转为 ScriptContent（无效则 null） */
export function scriptFromJson(raw: unknown): ScriptContent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray((o as any).scenes)) return null
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

  await pipelineRepository.updateJob(jobId, payload)
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

async function fillEpisodeSynopses(projectId: string) {
  const episodes = await projectRepository.findManyEpisodesOrdered(projectId)
  for (const ep of episodes) {
    if (ep.synopsis?.trim()) continue
    const sc = scriptFromJson(ep.script)
    if (!sc) continue
    const synopsis =
      sc.summary?.trim() || sc.scenes[0]?.description?.slice(0, 200) || `第${ep.episodeNum}集`
    await projectRepository.updateEpisodeSynopsis(ep.id, synopsis)
  }
}

export async function runGenerateFirstEpisode(projectId: string) {
  const project = await projectRepository.findUniqueById(projectId)
  if (!project) throw new Error('PROJECT_NOT_FOUND')

  const idea = project.description?.trim() || project.name

  // 检测是否为完整剧本
  const detectionResult = detectScriptMode(project.description || '')

  if (detectionResult.mode === 'faithful-parse' || detectionResult.mode === 'mixed') {
    // 完整剧本 → 存 synopsis，引导解析
    console.log('[generate-first] 检测到完整剧本，保存到 synopsis 并引导解析')
    await projectRepository.update(projectId, {
      synopsis: project.description,
      storyContext: (project.description || '').slice(0, 12000)
    })

    throw new Error('SHOULD_PARSE_SCRIPT_INSTEAD')
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
    .slice(0, 12000)

  await projectRepository.update(projectId, {
    synopsis: script.summary,
    storyContext
  })

  const episode = await projectRepository.upsertEpisodeFirstFromScript(projectId, script)

  // 提取第一集的记忆
  try {
    const memoryService = getMemoryService()
    await memoryService.extractAndSaveMemories(projectId, 1, episode.id, script, {
      userId: project.userId,
      projectId,
      op: 'extract_first_episode_memories'
    })
  } catch (error) {
    console.error('Failed to extract memories for first episode:', error)
    // 不阻断流程，继续执行
  }
}

/**
 * 将「生成第一集」绑定到 PipelineJob（互斥与刷新恢复）。
 * 仅由 `POST .../episodes/generate-first` 调用；`ensureAllEpisodeScripts` 内请直接调 `runGenerateFirstEpisode`。
 */
export async function runGenerateFirstEpisodePipelineJob(jobId: string, projectId: string) {
  await updateJob(jobId, {
    status: 'running',
    currentStep: 'script-first',
    progress: 5
  })
  try {
    await runGenerateFirstEpisode(projectId)
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      progressMeta: { message: '第一集已生成' }
    })
  } catch (e: any) {
    await updateJob(jobId, {
      status: 'failed',
      error: e?.message || '生成第一集失败',
      progressMeta: { message: e?.message }
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

/**
 * 阶段 1：并行生成所有集的大纲
 */
async function generateAllOutlines(
  projectId: string,
  targetEpisodes: number,
  seriesTitle: string,
  seriesSynopsis: string,
  concurrency: number = 5,
  modelLogCtx?: { userId: string; projectId: string; op: string }
): Promise<Map<number, string>> {
  const outlines = new Map<number, string>()
  const MAX_RETRIES = 2

  // 分批并行生成
  for (let batchStart = 1; batchStart <= targetEpisodes; batchStart += concurrency) {
    const batchEnd = Math.min(batchStart + concurrency - 1, targetEpisodes)

    console.log(`[outline-generation] 生成第 ${batchStart}-${batchEnd} 集大纲...`)

    await Promise.all(
      Array.from({ length: batchEnd - batchStart + 1 }, async (_, i) => {
        const epNum = batchStart + i
        let retries = 0

        while (retries < MAX_RETRIES) {
          try {
            const outline = await generateEpisodeOutline(
              epNum,
              seriesTitle,
              seriesSynopsis,
              modelLogCtx
            )

            // 验证大纲质量
            if (!outline || outline.length < 50) {
              throw new Error(`大纲质量不合格（长度：${outline?.length || 0}，要求至少 50 字）`)
            }

            outlines.set(epNum, outline)
            console.log(`[outline-generation] 第 ${epNum} 集大纲生成成功 (${outline.length} 字)`)
            break
          } catch (error) {
            retries++
            if (retries >= MAX_RETRIES) {
              console.error(
                `[outline-generation] 第 ${epNum} 集大纲生成失败（已重试 ${MAX_RETRIES} 次）`
              )
              throw error
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries))
          }
        }
      })
    )
  }

  return outlines
}

/**
 * 构建增强上下文：记忆 + 未来大纲参考
 */
function buildEnhancedContext(memoryContext: string, futureOutlines: string[]): string {
  const parts = [memoryContext]

  if (futureOutlines.length > 0) {
    parts.push('\n【后续剧情走向参考】')
    parts.push(futureOutlines.join('\n\n'))
    parts.push('\n注意：请确保本集剧情与后续发展自然衔接，埋下必要的伏笔。')
  }

  return parts.join('\n')
}

/**
 * 获取未来 N 集的大纲
 */
function getFutureOutlines(
  allOutlines: Map<number, string>,
  currentEpisode: number,
  lookahead: number = 2
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
  const memoryService = getMemoryService()
  const modelLogCtx = {
    userId: project.userId,
    projectId,
    op: 'script_batch_generation'
  }

  const mapBatchProgressToParseRange = (batchPct: number) =>
    Math.min(28, 8 + Math.round((Math.min(100, batchPct) / 100) * 20))

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
      await runFaithfulParse(jobId, projectId, targetEpisodes, detectionResult.episodes!, embedded)
      return
    }

    // ====== 模式 B：混合模式 ======
    if (detectionResult.mode === 'mixed') {
      console.log('[script-batch] 使用混合模式')
      await runMixedMode(
        jobId,
        projectId,
        targetEpisodes,
        detectionResult.episodes!,
        embedded,
        modelLogCtx
      )
      return
    }

    // ====== 模式 C：AI 创作（原有三阶段） ======
    console.log('[script-batch] 使用 AI 创作模式（三阶段）')
    if (useThreePhase) {
      console.log('[script-batch] 开始三阶段生成：大纲 → 审核 → 剧本')

      // 阶段 1：并行生成所有大纲
      await updateJob(jobId, {
        currentStep: 'outline-generation',
        progress: 5,
        progressMeta: { message: '正在生成所有集的大纲...' }
      })

      let allOutlines = await generateAllOutlines(
        projectId,
        targetEpisodes,
        project.name,
        synopsis,
        5, // 并发数
        modelLogCtx
      )

      console.log(`[script-batch] 阶段 1 完成：已生成 ${allOutlines.size} 集大纲`)

      // 阶段 2：AI 总编剧审核大纲
      await updateJob(jobId, {
        currentStep: 'showrunner-review',
        progress: 15,
        progressMeta: { message: 'AI 总编剧审核大纲一致性...' }
      })

      console.log('[script-batch] 阶段 2：开始 AI 总编剧审核...')
      let review = await showrunnerReviewOutlines(synopsis, allOutlines, modelLogCtx)

      const MAX_REVISION_ROUNDS = 2
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

        // AI 根据审核意见修正大纲
        allOutlines = await reviseOutlinesBasedOnFeedback(
          synopsis,
          allOutlines,
          review.feedback,
          modelLogCtx
        )

        console.log(`[showrunner] 第 ${revisionRound} 轮修正完成，重新审核...`)

        // 重新审核
        review = await showrunnerReviewOutlines(synopsis, allOutlines, modelLogCtx)

        if (review.approved) {
          console.log('[showrunner] 大纲审核通过 ✅')
          break
        }
      }

      // 审核结果处理
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

      let rolling = project.storyContext || synopsis

      // 串行生成每一集，确保上下文连贯性和质量
      for (let n = 1; n <= targetEpisodes; n++) {
        // 检查是否已存在
        const existing = await projectRepository.findEpisodeByProjectNum(projectId, n)
        if (existing && scriptFromJson(existing.script)) {
          const pct = Math.round(((n - 1) / Math.max(1, targetEpisodes - 1)) * 100)
          const progress = embedded
            ? mapBatchProgressToParseRange(pct)
            : 20 + Math.round((pct / 100) * 75)
          await updateJob(jobId, {
            progress,
            progressMeta: {
              current: n,
              total: targetEpisodes,
              message: `第 ${n} 集已存在，跳过`
            }
          })
          continue
        }

        console.log(`[script-batch] 开始生成第 ${n}/${targetEpisodes} 集剧本...`)

        // 构建增强上下文：记忆 + 未来大纲
        let episodeContext = rolling
        try {
          const memoryContext = await memoryService.getEpisodeWritingContext(projectId, n)
          if (memoryContext.fullContext && !memoryContext.fullContext.includes('（暂无）')) {
            const futureOutlines = getFutureOutlines(allOutlines, n, 2)
            episodeContext = buildEnhancedContext(memoryContext.fullContext, futureOutlines)
          }
        } catch (error) {
          console.error('Failed to build memory context, falling back to rolling context:', error)
        }

        const { script } = await writeEpisodeForProject(n, synopsis, episodeContext, project.name, {
          userId: project.userId,
          projectId,
          op: 'script_batch_write_episode'
        })

        const episode = await projectRepository.upsertEpisodeBatchFromScript(projectId, n, script)

        rolling = [rolling, `第${n}集：${script.summary}`].join('\n').slice(-12000)
        await projectRepository.update(projectId, { storyContext: rolling })

        // 提取记忆（同步等待，确保质量）
        try {
          await memoryService.extractAndSaveMemories(projectId, n, episode.id, script, {
            userId: project.userId,
            projectId,
            op: 'extract_episode_memories'
          })
        } catch (error) {
          console.error(`Failed to extract memories for episode ${n}:`, error)
        }

        const pct = Math.round(((n - 1) / Math.max(1, targetEpisodes - 1)) * 100)
        const progress = embedded
          ? mapBatchProgressToParseRange(pct)
          : 20 + Math.round((pct / 100) * 75)
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
    } else {
      // ====== 旧版串行生成（兼容模式） ======
      console.log('[script-batch] 使用旧版串行生成模式')
      let rolling = project.storyContext || synopsis

      for (let n = 2; n <= targetEpisodes; n++) {
        const existing = await projectRepository.findEpisodeByProjectNum(projectId, n)
        if (existing && scriptFromJson(existing.script)) {
          const pct = Math.round(((n - 1) / Math.max(1, targetEpisodes - 1)) * 100)
          const progress = embedded ? mapBatchProgressToParseRange(pct) : Math.min(99, pct)
          await updateJob(jobId, {
            progress,
            progressMeta: {
              current: n,
              total: targetEpisodes,
              message: `第 ${n} 集已存在，跳过`
            }
          })
          continue
        }

        console.log(`[script-batch] 开始生成第 ${n}/${targetEpisodes} 集...`)

        let episodeContext = rolling
        try {
          const memoryContext = await memoryService.getEpisodeWritingContext(projectId, n)
          if (memoryContext.fullContext && !memoryContext.fullContext.includes('（暂无）')) {
            episodeContext = memoryContext.fullContext
          }
        } catch (error) {
          console.error('Failed to build memory context, falling back to rolling context:', error)
        }

        const { script } = await writeEpisodeForProject(n, synopsis, episodeContext, project.name, {
          userId: project.userId,
          projectId,
          op: 'script_batch_write_episode'
        })

        const episode = await projectRepository.upsertEpisodeBatchFromScript(projectId, n, script)

        rolling = [rolling, `第${n}集：${script.summary}`].join('\n').slice(-12000)
        await projectRepository.update(projectId, { storyContext: rolling })

        try {
          await memoryService.extractAndSaveMemories(projectId, n, episode.id, script, {
            userId: project.userId,
            projectId,
            op: 'extract_episode_memories'
          })
        } catch (error) {
          console.error(`Failed to extract memories for episode ${n}:`, error)
        }

        const pct = Math.round(((n - 1) / Math.max(1, targetEpisodes - 1)) * 100)
        const progress = embedded ? mapBatchProgressToParseRange(pct) : Math.min(99, pct)
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
  } catch (e: any) {
    console.error('[script-batch] 任务执行失败:', {
      jobId,
      projectId,
      error: e.message,
      stack: e.stack
    })

    await updateJob(jobId, {
      status: 'failed',
      error: e?.message || '批量生成失败',
      progressMeta: { message: e?.message }
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
    await runGenerateFirstEpisode(projectId)
    if (reusePipelineJobId) {
      await updateJob(reusePipelineJobId, {
        progress: 7,
        progressMeta: { message: '已补全第一集，检查其余剧集…' }
      })
    }
  }

  let needBatch = false
  for (let n = 2; n <= targetEpisodes; n++) {
    const ep = await projectRepository.findEpisodeByProjectNum(projectId, n)
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
    const projectWithVisual = project as any
    if (!projectWithVisual.visualStyleConfig) {
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

        await projectRepository.update(projectId, { visualStyleConfig: config } as any)
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

    console.log('[parse-script] 开始应用视觉增强')
    await applyScriptVisualEnrichment(projectId, merged)

    console.log('[parse-script] 填充分集简介')
    await fillEpisodeSynopses(projectId)

    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      progressMeta: { message: '解析完成' }
    })

    console.log('[parse-script] 解析任务完成')
  } catch (e: any) {
    console.error('[parse-script] 解析任务失败:', {
      jobId,
      projectId,
      error: e.message,
      stack: e.stack
    })

    await updateJob(jobId, {
      status: 'failed',
      error: e?.message || '解析失败',
      progressMeta: { message: e?.message }
    })

    throw e
  }
}

// ============================================
// 智能剧本模式检测
// ============================================

/**
 * 忠实解析模式：格式化完整剧本，不改变内容
 */
async function runFaithfulParse(
  jobId: string,
  projectId: string,
  targetEpisodes: number,
  episodes: EpisodeCompleteness[],
  embedded: boolean
) {
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) return

  const totalEpisodes = episodes.length
  let completed = 0

  for (const ep of episodes) {
    if (!ep.content) continue

    completed++
    const progress = embedded
      ? 8 + Math.round((completed / totalEpisodes) * 20)
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
    try {
      const memoryService = getMemoryService()
      await memoryService.extractAndSaveMemories(projectId, ep.episodeNum, episode.id, script, {
        userId: project.userId,
        projectId,
        op: 'extract_faithful_parse_memories'
      })
    } catch (error) {
      console.error(`[faithful-parse] 第 ${ep.episodeNum} 集记忆提取失败:`, error)
    }
  }

  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    progressMeta: { message: `忠实解析完成，共 ${totalEpisodes} 集` }
  })
}

/**
 * 混合模式：部分忠实解析、部分扩展、部分 AI 创作
 */
async function runMixedMode(
  jobId: string,
  projectId: string,
  targetEpisodes: number,
  episodes: EpisodeCompleteness[],
  embedded: boolean,
  modelLogCtx: { userId: string; projectId: string; op: string }
) {
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) return

  const synopsis = project.synopsis || ''
  const memoryService = getMemoryService()

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

    try {
      await memoryService.extractAndSaveMemories(
        projectId,
        ep.episodeNum,
        episode.id,
        script,
        modelLogCtx
      )
    } catch (error) {
      console.error(`[mixed] 第 ${ep.episodeNum} 集记忆提取失败:`, error)
    }
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

    try {
      await memoryService.extractAndSaveMemories(
        projectId,
        ep.episodeNum,
        episode.id,
        script,
        modelLogCtx
      )
    } catch (error) {
      console.error(`[mixed] 第 ${ep.episodeNum} 集记忆提取失败:`, error)
    }
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

  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    progressMeta: { message: `混合模式完成，共处理 ${completed}/${total} 集` }
  })
}

// ============================================
// 智能剧本模式检测
// ============================================

/** 单集处理模式 */
export type EpisodeProcessingMode = 'faithful-parse' | 'expand' | 'ai-create'

/** 单集完整度检测结果 */
export interface EpisodeCompleteness {
  episodeNum: number
  mode: EpisodeProcessingMode
  confidence: number
  content?: string
}

/**
 * 计算文本完整度分数
 * @param content 文本内容
 * @returns 分数 0-8
 */
function calculateCompletenessScore(content: string): number {
  let score = 0

  // 指标 1：场景标记（第X场/scene X）- 2分
  if (/第?\d+[场景场]|scene\s*\d*/i.test(content)) score += 2

  // 指标 2：对话格式（引号或角色名+冒号）- 2分
  if (/[""「"]|[\u4e00-\u9fa5]+[：:]\s*[""「"]/.test(content)) score += 2

  // 指标 3：角色说明 - 1分
  if (/角色[：:]|人物[：:]|character/i.test(content)) score += 1

  // 指标 4：字数 - 最多 2分
  if (content.length > 1000) score += 1
  if (content.length > 3000) score += 1

  return score
}

/**
 * 按集分割剧本
 * @param script 完整剧本文本
 * @returns 分集数组
 */
function splitScriptByEpisodes(script: string): Array<{ num: number; content: string }> {
  const episodes: Array<{ num: number; content: string }> = []

  // 匹配 "第X集" 或 "Episode X"
  const regex = /第\s*(\d+)\s*集[\s\S]*?(?=第\s*\d+\s*集|$)/g
  let match

  while ((match = regex.exec(script)) !== null) {
    episodes.push({
      num: parseInt(match[1], 10),
      content: match[0].trim()
    })
  }

  return episodes
}

/**
 * 全剧本级别检测（快速判断）
 * @param script 完整剧本文本
 * @returns 分数 0-8
 */
export function calculateOverallScore(script: string): number {
  let score = 0

  // 指标 1：分集标记 - 3分（最重要指标）
  const episodeMatches = script.match(/第\s*\d+\s*集/gi) || []
  if (episodeMatches.length >= 3) score += 3
  else if (episodeMatches.length >= 1) score += 2

  // 指标 2：场景标记 - 2分
  if (/第?\d+[场景场]|scene\s*\d*/i.test(script)) score += 2

  // 指标 3：对话格式 - 2分
  if (/[""「"]|[\u4e00-\u9fa5]+[：:]\s*[""「"]/.test(script)) score += 2

  // 指标 4：字数 - 1分（阈值提高到5000）
  if (script.length > 5000) score += 1

  // 指标 5：角色说明 - 2分
  if (/角色[：:]|人物[：:]|character/i.test(script)) score += 2

  return score
}

/**
 * 逐集检测（精细判断）
 * @param script 完整剧本文本
 * @returns 每集的处理模式
 */
export function detectEpisodesMode(script: string): EpisodeCompleteness[] {
  const episodes = splitScriptByEpisodes(script)

  if (episodes.length === 0) {
    // 无法分集，返回空数组
    return []
  }

  return episodes.map((ep) => {
    const score = calculateCompletenessScore(ep.content)

    if (score >= 6) {
      // 完整剧本 → 忠实解析
      return {
        episodeNum: ep.num,
        mode: 'faithful-parse' as const,
        confidence: 0.95,
        content: ep.content
      }
    } else if (score >= 3) {
      // 有大纲/简要内容 → 扩展生成
      return {
        episodeNum: ep.num,
        mode: 'expand' as const,
        confidence: 0.8,
        content: ep.content
      }
    } else {
      // 完全缺失 → AI 创作
      return {
        episodeNum: ep.num,
        mode: 'ai-create' as const,
        confidence: 0.7,
        content: undefined
      }
    }
  })
}

/**
 * 智能检测剧本处理模式
 * @param script 完整剧本文本
 * @returns 检测结果
 */
export function detectScriptMode(
  script: string
):
  | { mode: 'faithful-parse'; episodes?: EpisodeCompleteness[] }
  | { mode: 'expand'; episodes: EpisodeCompleteness[] }
  | { mode: 'mixed'; episodes: EpisodeCompleteness[] }
  | { mode: 'ai-create'; episodes?: never } {
  const overallScore = calculateOverallScore(script)

  if (overallScore >= 5) {
    // 可能是完整剧本，逐集验证
    const episodesMode = detectEpisodesMode(script)

    if (episodesMode.length === 0) {
      // 无法分集，降级为 AI 创作
      console.log(`[detect] 全剧本得分 ${overallScore}/8，但无法分集，降级为 AI 创作`)
      return { mode: 'ai-create' }
    }

    const hasMixedMode = episodesMode.some((ep) => ep.mode !== 'faithful-parse')

    if (hasMixedMode) {
      // 混合模式：部分完整、部分缺失
      const faithfulCount = episodesMode.filter((ep) => ep.mode === 'faithful-parse').length
      const expandCount = episodesMode.filter((ep) => ep.mode === 'expand').length
      const createCount = episodesMode.filter((ep) => ep.mode === 'ai-create').length

      console.log(
        `[detect] 检测到混合模式：${faithfulCount} 集忠实解析，${expandCount} 集扩展生成，${createCount} 集 AI 创作`
      )
      return { mode: 'mixed', episodes: episodesMode }
    } else {
      // 全部完整
      console.log(`[detect] 检测到完整剧本（${episodesMode.length} 集），使用忠实解析模式`)
      return { mode: 'faithful-parse', episodes: episodesMode }
    }
  } else {
    // 整体不完整，使用 AI 创作
    console.log(`[detect] 全剧本得分 ${overallScore}/8，检测到创意想法，使用 AI 创作模式`)
    return { mode: 'ai-create' }
  }
}
