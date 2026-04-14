import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import type { VideoJobData } from '@dreamer/shared/types'
import { videoQueueService } from '../services/video-queue-service.js'
import { submitWan26Task, waitForWan26Completion, calculateWan26Cost } from '../services/ai/wan26.js'
import { submitSeedanceTask, waitForSeedanceCompletion, calculateSeedanceCost } from '../services/ai/seedance.js'
import { uploadFile, generateFileKey } from '../services/storage.js'
import { sendTaskUpdate } from '../plugins/sse.js'
import { logApiCall, updateApiCall } from '../services/ai/api-logger.js'

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

// Video Worker
export const videoWorker = new Worker<VideoJobData>(
  'video-generation',
  async (job) => {
    const { sceneId, taskId, prompt, model, referenceImage, imageUrls, duration } = job.data

    console.log(`Processing video job ${job.id} for scene ${sceneId}, model: ${model}`)

    const effectiveDuration = duration || 5

    // Get userId for SSE notification
    const userId = await videoQueueService.getProjectUserIdForTask(taskId)

    // 在try-catch外部声明变量，确保在catch块中可访问
    let videoUrl: string = ''
    let thumbnailUrl: string = ''
    let cost: number = 0
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

      if (model === 'wan2.6') {
        // Wan 2.6 API call
        console.log(`Submitting Wan 2.6 task for scene ${sceneId}`)

        // Log API call
        if (userId) {
          const log = await logApiCall({
            userId,
            model: 'wan2.6',
            provider: 'atlas',
            prompt,
            requestParams: { referenceImage, duration: effectiveDuration },
            takeId: taskId
          })
          apiCallId = log.id
        }

        const response = await submitWan26Task({
          prompt,
          referenceImage,
          duration: effectiveDuration
        })

        externalTaskId = response.taskId

        // Save external task ID to both Take and ApiCall
        await videoQueueService.setTaskExternalTaskId(taskId, externalTaskId)

        if (apiCallId) {
          await updateApiCall(externalTaskId, { status: 'processing' })
        }

        const result = await waitForWan26Completion(response.taskId)

        if (!result.videoUrl) {
          if (apiCallId) {
            await updateApiCall(externalTaskId, { status: 'failed', errorMsg: 'No video URL returned' })
          }
          throw new Error('Wan 2.6 returned no video URL')
        }

        videoUrl = result.videoUrl
        thumbnailUrl = result.thumbnailUrl || ''
        cost = calculateWan26Cost(effectiveDuration)

        if (apiCallId) {
          await updateApiCall(externalTaskId, {
            status: 'completed',
            responseData: { videoUrl, thumbnailUrl },
            cost,
            duration: effectiveDuration
          })
        }

      } else {
        // Seedance 2.0 API call
        console.log(`Submitting Seedance 2.0 task for scene ${sceneId}, reference images: ${imageUrls?.length || 0}`)

        // Log API call
        if (userId) {
          const log = await logApiCall({
            userId,
            model: 'seedance2.0',
            provider: 'volcengine',
            prompt,
            requestParams: { imageUrls, duration: effectiveDuration },
            takeId: taskId
          })
          apiCallId = log.id
        }

        const response = await submitSeedanceTask({
          prompt,
          imageUrls: imageUrls,
          duration: effectiveDuration
        })

        externalTaskId = response.taskId

        // Save external task ID to both Take and ApiCall
        await videoQueueService.setTaskExternalTaskId(taskId, externalTaskId)

        if (apiCallId) {
          await updateApiCall(externalTaskId, { status: 'processing' })
        }

        const result = await waitForSeedanceCompletion(response.taskId)

        if (!result.videoUrl) {
          if (apiCallId) {
            await updateApiCall(externalTaskId, { status: 'failed', errorMsg: 'No video URL returned' })
          }
          throw new Error('Seedance 2.0 returned no video URL')
        }

        videoUrl = result.videoUrl
        thumbnailUrl = result.thumbnailUrl || ''
        cost = calculateSeedanceCost(effectiveDuration)

        if (apiCallId) {
          await updateApiCall(externalTaskId, {
            status: 'completed',
            responseData: { videoUrl, thumbnailUrl },
            cost,
            duration: effectiveDuration
          })
        }
      }

      // Download video and upload to MinIO
      console.log(`Downloading video from ${videoUrl} and uploading to MinIO`)
      const videoResponse = await fetch(videoUrl)
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())

      const videoKey = generateFileKey('videos', `${taskId}.mp4`)
      const uploadedVideoUrl = await uploadFile(
        'videos',
        videoKey,
        videoBuffer,
        'video/mp4'
      )

      // Upload thumbnail if exists
      let uploadedThumbnailUrl = ''
      if (thumbnailUrl) {
        const thumbResponse = await fetch(thumbnailUrl)
        const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer())
        const thumbKey = generateFileKey('assets', `${taskId}_thumb.jpg`)
        uploadedThumbnailUrl = await uploadFile(
          'assets',
          thumbKey,
          thumbBuffer,
          'image/jpeg'
        )
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

      console.log(`Video job ${job.id} completed successfully with URL: ${uploadedVideoUrl}`)

    } catch (error) {
      console.error(`Video job ${job.id} failed:`, error)

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
  console.log(`Job ${job.id} has completed`)
})

videoWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with error: ${err.message}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down video worker...')
  await videoWorker.close()
  await connection.quit()
})
