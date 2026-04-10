import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../index.js'
import type { VideoJobData } from '@shared/types'
import { submitWan26Task, waitForWan26Completion, calculateWan26Cost } from '../services/wan26.js'
import { submitSeedanceTask, waitForSeedanceCompletion, calculateSeedanceCost } from '../services/seedance.js'
import { uploadFile, generateFileKey } from '../services/storage.js'

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
    const { sceneId, taskId, prompt, model, referenceImage, duration } = job.data

    console.log(`Processing video job ${job.id} for scene ${sceneId}, model: ${model}`)

    const effectiveDuration = duration || 5

    try {
      // Update task status to processing
      await prisma.videoTask.update({
        where: { id: taskId },
        data: { status: 'processing' }
      })

      // Update scene status
      await prisma.scene.update({
        where: { id: sceneId },
        data: { status: 'processing' }
      })

      let videoUrl: string
      let thumbnailUrl: string
      let cost: number

      if (model === 'wan2.6') {
        // Wan 2.6 API call
        console.log(`Submitting Wan 2.6 task for scene ${sceneId}`)
        const response = await submitWan26Task({
          prompt,
          referenceImage,
          duration: effectiveDuration
        })

        const result = await waitForWan26Completion(response.taskId)

        if (!result.videoUrl) {
          throw new Error('Wan 2.6 returned no video URL')
        }

        videoUrl = result.videoUrl
        thumbnailUrl = result.thumbnailUrl || ''
        cost = calculateWan26Cost(effectiveDuration)

      } else {
        // Seedance 2.0 API call
        console.log(`Submitting Seedance 2.0 task for scene ${sceneId}`)
        const response = await submitSeedanceTask({
          prompt,
          referenceImage,
          duration: effectiveDuration
        })

        const result = await waitForSeedanceCompletion(response.taskId)

        if (!result.videoUrl) {
          throw new Error('Seedance 2.0 returned no video URL')
        }

        videoUrl = result.videoUrl
        thumbnailUrl = result.thumbnailUrl || ''
        cost = calculateSeedanceCost(effectiveDuration)
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
      await prisma.videoTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          videoUrl: uploadedVideoUrl,
          thumbnailUrl: uploadedThumbnailUrl,
          cost,
          duration: effectiveDuration
        }
      })

      // Update scene status
      await prisma.scene.update({
        where: { id: sceneId },
        data: { status: 'completed' }
      })

      console.log(`Video job ${job.id} completed successfully with URL: ${uploadedVideoUrl}`)

    } catch (error) {
      console.error(`Video job ${job.id} failed:`, error)

      // Update task as failed
      await prisma.videoTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorMsg: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      // Update scene status
      await prisma.scene.update({
        where: { id: sceneId },
        data: { status: 'failed' }
      })

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
