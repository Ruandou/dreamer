import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import type { ImageGenerationJobData } from '@dreamer/shared/types'
import {
  generateTextToImageAndPersist,
  generateImageEditAndPersist,
  arkImageSizeFromProjectAspectRatio,
  imageJobPrompt,
  imageJobModel
} from '../services/ai/image-generation.js'
import { recordModelApiCall } from '../services/ai/api-logger.js'
import { sendProjectUpdate } from '../plugins/sse.js'
import { imageQueueService } from '../services/image-queue-service.js'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

export const imageQueue = new Queue<ImageGenerationJobData>('image-generation', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 4000
    }
  }
})

function notify(userId: string, projectId: string, payload: Record<string, unknown>) {
  try {
    sendProjectUpdate(userId, projectId, 'image-generation', payload)
  } catch (e) {
    console.warn('image job SSE notify failed', e)
  }
}

const imageWorker = new Worker<ImageGenerationJobData>(
  'image-generation',
  async (job) => {
    const data = job.data
    const { userId, projectId } = data
    console.log(`[image-generation] job ${job.id} kind=${data.kind}`)

    const projectRow = await imageQueueService.getProjectAspectRatio(projectId)
    const imageSize = arkImageSizeFromProjectAspectRatio(projectRow?.aspectRatio)

    try {
      switch (data.kind) {
        case 'character_base_create': {
          const { url: avatarUrl, imageCost } = await generateTextToImageAndPersist(data.prompt, {
            size: imageSize
          })
          const maxOrder = await imageQueueService.maxOrderForCharacterSlot(data.characterId, null)
          const image = await imageQueueService.createCharacterImageBase({
            characterId: data.characterId,
            name: data.name,
            parentId: null,
            type: 'base',
            avatarUrl,
            imageCost: imageCost ?? null,
            order: (maxOrder._max.order || 0) + 1
          })
          notify(userId, projectId, {
            status: 'completed',
            kind: data.kind,
            characterImageId: image.id,
            characterId: data.characterId,
            imageCost: imageCost ?? null
          })
          await recordModelApiCall({
            userId,
            model: imageJobModel(data),
            provider: 'volcengine-ark',
            prompt: imageJobPrompt(data),
            requestParams: {
              op: 'image_generation_job',
              kind: data.kind,
              projectId,
              jobId: job.id
            },
            status: 'completed',
            cost: imageCost ?? null
          })
          return { characterImageId: image.id, imageCost: imageCost ?? null }
        }
        case 'character_base_regenerate': {
          const { url: avatarUrl, imageCost } = await generateTextToImageAndPersist(data.prompt, {
            size: imageSize
          })
          const updated = await imageQueueService.updateCharacterImageAvatar(
            data.characterImageId,
            {
              avatarUrl,
              prompt: data.prompt,
              imageCost: imageCost ?? null
            }
          )
          notify(userId, projectId, {
            status: 'completed',
            kind: data.kind,
            characterImageId: updated.id,
            characterId: updated.characterId,
            imageCost: imageCost ?? null
          })
          await recordModelApiCall({
            userId,
            model: imageJobModel(data),
            provider: 'volcengine-ark',
            prompt: imageJobPrompt(data),
            requestParams: {
              op: 'image_generation_job',
              kind: data.kind,
              projectId,
              jobId: job.id
            },
            status: 'completed',
            cost: imageCost ?? null
          })
          return { characterImageId: updated.id, imageCost: imageCost ?? null }
        }
        case 'character_derived_regenerate': {
          const { url: avatarUrl, imageCost } = await generateImageEditAndPersist(
            data.referenceImageUrl,
            data.editPrompt,
            { strength: data.strength ?? 0.35, size: imageSize }
          )
          const updated = await imageQueueService.updateCharacterImageAvatar(
            data.characterImageId,
            {
              avatarUrl,
              prompt: data.editPrompt,
              imageCost: imageCost ?? null
            }
          )
          notify(userId, projectId, {
            status: 'completed',
            kind: data.kind,
            characterImageId: updated.id,
            characterId: updated.characterId,
            imageCost: imageCost ?? null
          })
          await recordModelApiCall({
            userId,
            model: imageJobModel(data),
            provider: 'volcengine-ark',
            prompt: imageJobPrompt(data),
            requestParams: {
              op: 'image_generation_job',
              kind: data.kind,
              projectId,
              jobId: job.id
            },
            status: 'completed',
            cost: imageCost ?? null
          })
          return { characterImageId: updated.id, imageCost: imageCost ?? null }
        }
        case 'character_derived_create': {
          const { url: avatarUrl, imageCost } = await generateImageEditAndPersist(
            data.referenceImageUrl,
            data.editPrompt,
            { strength: data.strength ?? 0.35, size: imageSize }
          )
          const maxOrder = await imageQueueService.maxOrderForCharacterSlot(
            data.characterId,
            data.parentImageId
          )
          const image = await imageQueueService.createCharacterImageDerived({
            characterId: data.characterId,
            name: data.name,
            parentId: data.parentImageId,
            type: data.type || 'expression',
            description: data.description,
            avatarUrl,
            imageCost: imageCost ?? null,
            order: (maxOrder._max.order || 0) + 1
          })
          notify(userId, projectId, {
            status: 'completed',
            kind: data.kind,
            characterImageId: image.id,
            characterId: data.characterId,
            imageCost: imageCost ?? null
          })
          await recordModelApiCall({
            userId,
            model: imageJobModel(data),
            provider: 'volcengine-ark',
            prompt: imageJobPrompt(data),
            requestParams: {
              op: 'image_generation_job',
              kind: data.kind,
              projectId,
              jobId: job.id
            },
            status: 'completed',
            cost: imageCost ?? null
          })
          return { characterImageId: image.id, imageCost: imageCost ?? null }
        }
        case 'location_establishing': {
          const { url: imageUrl, imageCost } = await generateTextToImageAndPersist(data.prompt, {
            size: imageSize
          })
          const write = await imageQueueService.updateLocationEstablishingImage(data.locationId, {
            imageUrl,
            imageCost: imageCost ?? null
          })
          if (write.count === 0) {
            await recordModelApiCall({
              userId,
              model: imageJobModel(data),
              provider: 'volcengine-ark',
              prompt: imageJobPrompt(data),
              requestParams: {
                op: 'image_generation_job',
                kind: data.kind,
                projectId,
                jobId: job.id,
                skippedDbWrite: true
              },
              status: 'completed',
              cost: imageCost ?? null
            })
            return { locationId: data.locationId, imageCost: null }
          }
          notify(userId, projectId, {
            status: 'completed',
            kind: data.kind,
            locationId: data.locationId,
            imageCost: imageCost ?? null
          })
          await recordModelApiCall({
            userId,
            model: imageJobModel(data),
            provider: 'volcengine-ark',
            prompt: imageJobPrompt(data),
            requestParams: {
              op: 'image_generation_job',
              kind: data.kind,
              projectId,
              jobId: job.id
            },
            status: 'completed',
            cost: imageCost ?? null
          })
          return { locationId: data.locationId, imageCost: imageCost ?? null }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      await recordModelApiCall({
        userId,
        model: imageJobModel(data),
        provider: 'volcengine-ark',
        prompt: imageJobPrompt(data),
        requestParams: {
          op: 'image_generation_job',
          kind: data.kind,
          projectId,
          jobId: job.id
        },
        status: 'failed',
        errorMsg: message
      })
      const failPayload: Record<string, unknown> = {
        status: 'failed',
        kind: data.kind,
        error: message
      }
      if ('characterImageId' in data && (data as { characterImageId?: string }).characterImageId) {
        failPayload.characterImageId = (data as { characterImageId: string }).characterImageId
      }
      if ('characterId' in data && (data as { characterId?: string }).characterId) {
        failPayload.characterId = (data as { characterId: string }).characterId
      }
      if ('locationId' in data && (data as { locationId?: string }).locationId) {
        failPayload.locationId = (data as { locationId: string }).locationId
      }
      notify(userId, projectId, failPayload)
      throw error
    }
  },
  {
    connection,
    concurrency: 3
  }
)

imageWorker.on('completed', (job) => {
  console.log(`[image-generation] job ${job.id} completed`)
})

imageWorker.on('failed', (job, err) => {
  console.error(`[image-generation] job ${job?.id} failed:`, err?.message)
})

export async function closeImageWorker(): Promise<void> {
  await imageWorker.close()
  await imageQueue.close()
  await connection.quit()
}
