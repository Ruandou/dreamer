import { FastifyInstance } from 'fastify'
import { imageQueue } from '../queues/image.js'
import type { ImageGenerationJobData } from '@dreamer/shared/types'

function mapQueueState(state: string): 'pending' | 'queued' | 'processing' | 'completed' | 'failed' {
  if (state === 'completed') return 'completed'
  if (state === 'failed') return 'failed'
  if (state === 'active') return 'processing'
  if (state === 'waiting' || state === 'delayed') return 'queued'
  return 'pending'
}

export async function imageGenerationJobRoutes(fastify: FastifyInstance) {
  /** 当前用户最近的图片生成队列任务（BullMQ），用于任务中心 */
  fastify.get(
    '/jobs',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const userId = (request as any).user.id as string
      const types = ['completed', 'failed', 'active', 'waiting', 'delayed', 'paused'] as const
      const rawJobs = await imageQueue.getJobs([...types], 0, 199, false)

      const rows: Array<{
        id: string
        type: 'image'
        kind: string
        projectId: string
        status: ReturnType<typeof mapQueueState>
        createdAt: string
        updatedAt: string
        errorMsg?: string | null
        characterId?: string
        characterImageId?: string
        locationId?: string
        returnvalue?: unknown
      }> = []

      for (const job of rawJobs) {
        const data = job.data as ImageGenerationJobData
        if (!data?.userId || data.userId !== userId) continue

        const state = await job.getState()
        const status = mapQueueState(state)
        const createdAt = job.timestamp ? new Date(job.timestamp).toISOString() : new Date().toISOString()
        const updatedAt = job.finishedOn
          ? new Date(job.finishedOn).toISOString()
          : job.processedOn
            ? new Date(job.processedOn).toISOString()
            : createdAt

        const base = {
          id: String(job.id),
          type: 'image' as const,
          kind: data.kind,
          projectId: data.projectId,
          status,
          createdAt,
          updatedAt,
          errorMsg: job.failedReason || null,
          returnvalue: job.returnvalue
        }

        switch (data.kind) {
          case 'location_establishing':
            rows.push({ ...base, locationId: data.locationId })
            break
          case 'character_base_create':
            rows.push({ ...base, characterId: data.characterId })
            break
          case 'character_derived_create':
            rows.push({ ...base, characterId: data.characterId })
            break
          case 'character_base_regenerate':
          case 'character_derived_regenerate':
            rows.push({ ...base, characterImageId: data.characterImageId })
            break
          default:
            rows.push(base)
        }
      }

      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      return rows
    }
  )
}
