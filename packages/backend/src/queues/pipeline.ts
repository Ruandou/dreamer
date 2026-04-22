import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { getPipelineJobHandler } from './pipeline-job-strategies.js'
import { pipelineRepository } from '../repositories/pipeline-repository.js'
import { logInfo, logError } from '../lib/error-logger.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = new IORedis(REDIS_URL, {
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
    // Pipeline jobs run for a long time; no default timeout (each step controls its own).
    removeOnComplete: { age: 24 * 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600, count: 200 }
  }
})

export const pipelineWorker = new Worker<PipelineJobData>(
  'pipeline',
  async (job) => {
    const data = job.data
    const { jobId, jobType } = data

    logInfo('pipeline-worker', 'Starting job', {
      bullJobId: job.id,
      pipelineJobId: jobId,
      jobType
    })

    const handler = getPipelineJobHandler(jobType)
    await handler(data)

    logInfo('pipeline-worker', 'Job completed', { bullJobId: job.id, pipelineJobId: jobId })
  },
  {
    connection,
    concurrency: 2,
    // Long AI calls (e.g. outline generation ~30 min) mean no default timeout.
    lockDuration: 60000,
    stalledInterval: 30000
  }
)

pipelineWorker.on('completed', (job) => {
  logInfo('pipeline-worker', 'Job completed', { bullJobId: job.id })
})

pipelineWorker.on('failed', async (job, error) => {
  logError('pipeline-worker', error, { bullJobId: job?.id })
  // Fallback: update Prisma PipelineJob status if the handler did not do it.
  try {
    const data = job?.data as PipelineJobData | undefined
    if (data?.jobId) {
      await pipelineRepository.updateJob(data.jobId, {
        status: 'failed',
        error: error?.message ?? 'Worker 执行失败'
      })
    }
  } catch (updateError) {
    logError('pipeline-worker', updateError, { msg: '无法更新 PipelineJob 失败状态' })
  }
})

export async function closePipelineWorker(): Promise<void> {
  await pipelineWorker.close()
  await pipelineQueue.close()
}
