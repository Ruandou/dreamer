import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { executePipelineJob } from '../services/pipeline-executor.js'
import {
  runGenerateFirstEpisodePipelineJob,
  runScriptBatchJob,
  runParseScriptJob
} from '../services/project-script-jobs.js'
import { runEpisodeStoryboardPipelineJob } from '../services/episode-storyboard-job.js'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

export interface PipelineJobData {
  /** Prisma PipelineJob.id */
  jobId: string
  /** PipelineJob 类型 */
  jobType:
    | 'full-pipeline'
    | 'script-first'
    | 'script-batch'
    | 'parse-script'
    | 'episode-storyboard-script'
  projectId: string
  userId?: string
  // full-pipeline 参数
  idea?: string
  targetEpisodes?: number
  targetDuration?: number
  defaultAspectRatio?: '16:9' | '9:16' | '1:1'
  defaultResolution?: '480p' | '720p'
  // script-batch 参数
  options?: { embeddedInParse?: boolean; useThreePhase?: boolean }
  // episode-storyboard-script 参数
  episodeId?: string
  hint?: string | null
}

export const pipelineQueue = new Queue<PipelineJobData>('pipeline', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    backoff: {
      type: 'fixed',
      delay: 5000
    },
    // Pipeline 任务通常执行时间较长，不设默认超时，由各步骤自行控制
    removeOnComplete: { age: 24 * 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600, count: 200 }
  }
})

export const pipelineWorker = new Worker<PipelineJobData>(
  'pipeline',
  async (job) => {
    const data = job.data
    const { jobId, jobType, projectId } = data

    console.log(
      `[pipeline-worker] Starting job ${job.id} (pipelineJobId=${jobId}, type=${jobType})`
    )

    switch (jobType) {
      case 'full-pipeline': {
        if (!data.idea) throw new Error('full-pipeline 缺少 idea 参数')
        await executePipelineJob(jobId, {
          projectId,
          idea: data.idea,
          targetEpisodes: data.targetEpisodes,
          targetDuration: data.targetDuration,
          defaultAspectRatio: data.defaultAspectRatio ?? '9:16',
          defaultResolution: data.defaultResolution ?? '720p'
        })
        break
      }

      case 'script-first': {
        await runGenerateFirstEpisodePipelineJob(jobId, projectId)
        break
      }

      case 'script-batch': {
        const targetEpisodes = data.targetEpisodes ?? 36
        await runScriptBatchJob(jobId, projectId, targetEpisodes, data.options)
        break
      }

      case 'parse-script': {
        const targetEpisodes = data.targetEpisodes ?? 36
        await runParseScriptJob(jobId, projectId, targetEpisodes)
        break
      }

      case 'episode-storyboard-script': {
        if (!data.userId) throw new Error('episode-storyboard-script 缺少 userId')
        if (!data.episodeId) throw new Error('episode-storyboard-script 缺少 episodeId')
        await runEpisodeStoryboardPipelineJob(jobId, data.userId, data.episodeId, data.hint)
        break
      }

      default:
        throw new Error(`未知的 Pipeline jobType: ${jobType}`)
    }

    console.log(`[pipeline-worker] Job ${job.id} (pipelineJobId=${jobId}) completed`)
  },
  {
    connection,
    concurrency: 2,
    // Pipeline 步骤可能涉及长时间 AI 调用（如大纲生成 30 分钟），不设默认超时
    lockDuration: 60000,
    stalledInterval: 30000
  }
)

pipelineWorker.on('completed', (job) => {
  console.log(`[pipeline-worker] Job ${job.id} completed`)
})

pipelineWorker.on('failed', (job, err) => {
  console.error(`[pipeline-worker] Job ${job?.id} failed:`, err?.message)
})

export async function closePipelineWorker(): Promise<void> {
  await pipelineWorker.close()
  await pipelineQueue.close()
}
