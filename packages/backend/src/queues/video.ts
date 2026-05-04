import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import type { VideoJobData } from '@dreamer/shared/types'
import { videoQueueService } from '../services/video-queue-service.js'
import {
  getVideoProviderForUser,
  calculateSeedanceCost,
  calculateWan26Cost
} from '../services/ai/video/video-factory.js'
import type { VideoProvider, VideoStatusResponse } from '../services/ai/video/video-provider.js'
import { uploadFile, generateFileKey } from '../services/storage.js'
import { sendTaskUpdate } from '../plugins/sse.js'
import { logApiCall, updateApiCall } from '../services/ai/api-logger.js'
import { logInfo, logError, logWarning } from '../lib/error-logger.js'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

export const videoQueue = new Queue<VideoJobData>('video-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
})

/** 通用轮询等待视频生成完成 */
async function waitForVideoCompletion(
  provider: VideoProvider,
  taskId: string,
  maxWaitMs = 600000
): Promise<VideoStatusResponse> {
  const startTime = Date.now()
  const pollInterval = 5000

  while (Date.now() - startTime < maxWaitMs) {
    const status = await provider.queryStatus(taskId)

    if (status.status === 'completed') {
      return status
    }
    if (status.status === 'failed') {
      throw new Error(`视频生成失败: ${status.error || '未知错误'}`)
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error('视频生成超时')
}

/** 根据 provider 名称计算成本 */
function calculateCost(providerName: string, durationSeconds: number): number {
  switch (providerName) {
    case 'atlas':
      return calculateWan26Cost(durationSeconds)
    case 'ark':
    default:
      return calculateSeedanceCost(durationSeconds)
  }
}

// Video Worker
export const videoWorker = new Worker<VideoJobData>(
  'video-generation',
  async (job) => {
    const { sceneId, taskId, prompt, model, imageUrls, duration, aspectRatio } = job.data

    logInfo('video-worker', `Processing job for scene ${sceneId}`, {
      jobId: job.id,
      model
    })

    const effectiveDuration = duration || 5

    // Get userId for SSE notification
    const userId = await videoQueueService.getProjectUserIdForTask(taskId)

    // 获取用户偏好的 Video Provider，若未设置则使用默认
    const provider = userId
      ? await getVideoProviderForUser(userId)
      : await import('../services/ai/video/video-factory.js').then((m) =>
          m.getDefaultVideoProvider()
        )
    const providerName = provider.name

    // 在try-catch外部声明变量，确保在catch块中可访问
    let videoUrl: string
    let thumbnailUrl: string
    let cost: number
    let externalTaskId: string = ''
    let apiCallId: string = ''

    try {
      // Update task status to processing
      await videoQueueService.setTaskProcessing(taskId)

      // Send SSE notification
      if (userId) {
        sendTaskUpdate(userId, taskId, 'processing', { sceneId })
      }

      // Update scene status
      await videoQueueService.setSceneGenerating(sceneId)

      logInfo('video-worker', `Submitting ${providerName} task`, {
        sceneId,
        refImageCount: imageUrls?.length || 0
      })

      // Log API call
      if (userId) {
        const log = await logApiCall({
          userId,
          model: model || providerName,
          provider: providerName,
          prompt,
          requestParams: {
            imageUrls: imageUrls ? `[${imageUrls.length} images]` : undefined,
            duration: effectiveDuration,
            aspectRatio
          },
          takeId: taskId
        })
        apiCallId = log.id
      }

      // 将图片 URL 转换为 base64（Seedance/Ark 需要）
      const imageBase64 = imageUrls?.length
        ? await Promise.all(
            imageUrls.map(async (url) => {
              const res = await fetch(url)
              if (!res.ok) {
                throw new Error(`Failed to fetch image: ${res.status}`)
              }
              const arrayBuffer = await res.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)
              const mimeType = res.headers.get('content-type') || 'image/jpeg'
              return `data:${mimeType};base64,${buffer.toString('base64')}`
            })
          )
        : undefined

      const response = await provider.submitGeneration({
        prompt,
        imageUrls: imageBase64,
        duration: effectiveDuration,
        aspectRatio: aspectRatio ?? '9:16'
      })

      externalTaskId = response.taskId

      // Save external task ID to both Take and ApiCall
      await videoQueueService.setTaskExternalTaskId(taskId, externalTaskId)

      if (apiCallId) {
        await updateApiCall(externalTaskId, { status: 'processing' })
      }

      const result = await waitForVideoCompletion(provider, response.taskId)

      if (!result.videoUrl) {
        if (apiCallId) {
          await updateApiCall(externalTaskId, {
            status: 'failed',
            errorMsg: 'No video URL returned'
          })
        }
        throw new Error(`${providerName} returned no video URL`)
      }

      videoUrl = result.videoUrl
      thumbnailUrl = result.thumbnailUrl || ''
      cost = calculateCost(providerName, effectiveDuration)

      if (apiCallId) {
        await updateApiCall(externalTaskId, {
          status: 'completed',
          responseData: { videoUrl, thumbnailUrl },
          cost,
          duration: effectiveDuration
        })
      }

      // Download video and thumbnail in parallel, then upload to MinIO
      logInfo('video-worker', 'Downloading and uploading video to MinIO', { sceneId })
      const videoDownloadPromise = fetch(videoUrl).then(async (res) =>
        Buffer.from(await res.arrayBuffer())
      )
      const thumbnailDownloadPromise = thumbnailUrl
        ? fetch(thumbnailUrl).then(async (res) => Buffer.from(await res.arrayBuffer()))
        : Promise.resolve(null)

      const [videoBuffer, thumbBuffer] = await Promise.all([
        videoDownloadPromise,
        thumbnailDownloadPromise
      ])

      const videoKey = generateFileKey('videos', `${taskId}.mp4`)
      const uploadedVideoUrl = await uploadFile('videos', videoKey, videoBuffer, 'video/mp4')

      // Upload thumbnail if exists
      let uploadedThumbnailUrl = ''
      if (thumbBuffer) {
        const thumbKey = generateFileKey('assets', `${taskId}_thumb.jpg`)
        uploadedThumbnailUrl = await uploadFile('assets', thumbKey, thumbBuffer, 'image/jpeg')
      }

      // Update task as completed
      await videoQueueService.setTaskCompleted(taskId, {
        videoUrl: uploadedVideoUrl,
        thumbnailUrl: uploadedThumbnailUrl,
        cost,
        duration: effectiveDuration
      })

      await videoQueueService.setSceneCompleted(sceneId)

      // Send SSE notification
      if (userId) {
        sendTaskUpdate(userId, taskId, 'completed', {
          sceneId,
          videoUrl: uploadedVideoUrl,
          thumbnailUrl: uploadedThumbnailUrl,
          cost
        })
      }

      logInfo('video-worker', 'Job completed successfully', {
        jobId: job.id,
        url: uploadedVideoUrl
      })
    } catch (error) {
      logError('video-worker', error, { jobId: job.id, sceneId })

      // Update api call log if we have externalTaskId
      if (externalTaskId && apiCallId) {
        await updateApiCall(externalTaskId, {
          status: 'failed',
          errorMsg: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Update task as failed
      await videoQueueService.setTaskFailed(
        taskId,
        error instanceof Error ? error.message : 'Unknown error'
      )

      await videoQueueService.setSceneFailed(sceneId)

      // Send SSE notification
      if (userId) {
        sendTaskUpdate(userId, taskId, 'failed', {
          sceneId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      throw error
    }
  },
  {
    connection,
    concurrency: 5
  }
)

videoWorker.on('completed', (job) => {
  logInfo('video-worker', 'Job completed', { jobId: job.id })
})

videoWorker.on('failed', (job, err) => {
  logWarning('video-worker', 'Job failed', { jobId: job?.id, error: err.message })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logInfo('video-worker', 'Shutting down video worker')
  await videoWorker.close()
  await connection.quit()
})
