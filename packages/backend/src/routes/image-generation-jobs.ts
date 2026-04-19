import { FastifyInstance } from 'fastify'
import {
  listImageGenerationJobsForUser,
  type ImageGenerationJobBinding,
  type ImageGenerationJobRow
} from '../services/image-generation-job-service.js'
import { getRequestUserId } from '../plugins/auth.js'

export type { ImageGenerationJobBinding, ImageGenerationJobRow }

export async function imageGenerationJobRoutes(fastify: FastifyInstance) {
  /** 当前用户最近的图片生成队列任务（BullMQ），用于任务中心 */
  fastify.get('/jobs', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = getRequestUserId(request)
    return listImageGenerationJobsForUser(userId)
  })
}
