import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { videoQueue } from '../queues/video.js'
import { optimizePrompt } from '../services/deepseek.js'
import { verifySegmentOwnership, verifyEpisodeOwnership } from '../plugins/auth.js'
import type { VideoModel } from '@dreamer/shared/types'

export async function sceneRoutes(fastify: FastifyInstance) {
  // List segments for an episode
  fastify.get<{ Querystring: { episodeId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { episodeId } = request.query

      // Verify episode ownership
      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
      }

      return prisma.segment.findMany({
        where: { episodeId },
        orderBy: { segmentNum: 'asc' },
        include: {
          tasks: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    }
  )

  // Get segment
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const segmentId = request.params.id

      if (!(await verifySegmentOwnership(userId, segmentId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this segment' })
      }

      const segment = await prisma.segment.findUnique({
        where: { id: segmentId },
        include: { tasks: { orderBy: { createdAt: 'desc' } } }
      })

      if (!segment) {
        return reply.status(404).send({ error: 'Segment not found' })
      }

      return segment
    }
  )

  // Create segment
  fastify.post<{ Body: { episodeId: string; segmentNum: number; description?: string; prompt: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { episodeId, segmentNum, description, prompt } = request.body

      // Verify episode ownership
      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
      }

      const segment = await prisma.segment.create({
        data: { episodeId, segmentNum, prompt, description }
      })

      return reply.status(201).send(segment)
    }
  )

  // Update segment
  fastify.put<{ Params: { id: string }; Body: { description?: string; prompt?: string; segmentNum?: number } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const segmentId = request.params.id

      if (!(await verifySegmentOwnership(userId, segmentId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this segment' })
      }

      const { description, prompt, segmentNum } = request.body

      const segment = await prisma.segment.update({
        where: { id: segmentId },
        data: { description, prompt, ...(segmentNum !== undefined && { segmentNum }) }
      })

      return segment
    }
  )

  // Delete segment
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const segmentId = request.params.id

      if (!(await verifySegmentOwnership(userId, segmentId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this segment' })
      }

      const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
      if (!segment) {
        return reply.status(404).send({ error: 'Segment not found' })
      }

      await prisma.segment.delete({ where: { id: segmentId } })
      return reply.status(204).send()
    }
  )

  // Generate video for segment
  fastify.post<{ Params: { id: string }; Body: { model: VideoModel; referenceImage?: string; imageUrls?: string[]; duration?: number } }>(
    '/:id/generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const segmentId = request.params.id

      if (!(await verifySegmentOwnership(userId, segmentId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this segment' })
      }

      const { model, referenceImage, imageUrls, duration } = request.body

      const segment = await prisma.segment.findUnique({
        where: { id: segmentId }
      })

      if (!segment) {
        return reply.status(404).send({ error: 'Segment not found' })
      }

      // Create video task
      const task = await prisma.videoTask.create({
        data: {
          segmentId: segment.id,
          model,
          status: 'queued',
          prompt: segment.prompt
        }
      })

      // Add to queue
      await videoQueue.add('generate-video', {
        segmentId: segment.id,
        taskId: task.id,
        prompt: segment.prompt,
        model,
        referenceImage,
        imageUrls,
        duration
      })

      // Update segment status
      await prisma.segment.update({
        where: { id: segment.id },
        data: { status: 'generating' }
      })

      return { taskId: task.id, segmentId: segment.id }
    }
  )

  // Batch generate videos
  fastify.post<{ Body: { segmentIds: string[]; model: VideoModel; referenceImage?: string; imageUrls?: string[] } }>(
    '/batch-generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { segmentIds, model, referenceImage, imageUrls } = request.body

      const results = []

      for (const segmentId of segmentIds) {
        // Verify ownership for each segment
        if (!(await verifySegmentOwnership(userId, segmentId))) {
          continue
        }

        const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
        if (!segment) continue

        const task = await prisma.videoTask.create({
          data: {
            segmentId,
            model,
            status: 'queued',
            prompt: segment.prompt
          }
        })

        await videoQueue.add('generate-video', {
          segmentId: segment.id,
          taskId: task.id,
          prompt: segment.prompt,
          model,
          referenceImage,
          imageUrls
        })

        await prisma.segment.update({
          where: { id: segment.id },
          data: { status: 'generating' }
        })

        results.push({ segmentId, taskId: task.id })
      }

      return results
    }
  )

  // Select a task as the final version
  fastify.post<{ Params: { id: string; taskId: string } }>(
    '/:id/tasks/:taskId/select',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { id: segmentId, taskId } = request.params

      if (!(await verifySegmentOwnership(userId, segmentId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this segment' })
      }

      // Unselect all other tasks for this segment
      await prisma.videoTask.updateMany({
        where: { segmentId },
        data: { isSelected: false }
      })

      // Select this task
      const task = await prisma.videoTask.update({
        where: { id: taskId },
        data: { isSelected: true }
      })

      return task
    }
  )

  // Get all tasks for a segment
  fastify.get<{ Params: { id: string } }>(
    '/:id/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const segmentId = request.params.id

      if (!(await verifySegmentOwnership(userId, segmentId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this segment' })
      }

      return prisma.videoTask.findMany({
        where: { segmentId },
        orderBy: { createdAt: 'desc' }
      })
    }
  )

  // Optimize prompt with AI
  fastify.post<{ Params: { id: string }; Body: { prompt?: string } }>(
    '/:id/optimize-prompt',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const segmentId = request.params.id

      if (!(await verifySegmentOwnership(userId, segmentId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this segment' })
      }

      const { prompt } = request.body

      const segment = await prisma.segment.findUnique({
        where: { id: segmentId },
        include: { episode: { include: { project: { include: { characters: true } } } } }
      })

      if (!segment) {
        return reply.status(404).send({ error: 'Segment not found' })
      }

      const targetPrompt = prompt || segment.prompt

      // Build context with characters
      const characters = segment.episode.project.characters
      const context = characters.length > 0
        ? `角色设定：${characters.map((c: any) => `${c.name}: ${c.description || '未描述'}`).join('; ')}`
        : undefined

      try {
        const { optimized, cost } = await optimizePrompt(targetPrompt, context)

        // Optionally update the segment with optimized prompt
        if (!prompt) {
          await prisma.segment.update({
            where: { id: segmentId },
            data: { prompt: optimized }
          })
        }

        return { optimizedPrompt: optimized, aiCost: cost.costCNY }
      } catch (error) {
        console.error('Prompt optimization failed:', error)

        if (error instanceof Error && error.name === 'DeepSeekAuthError') {
          return reply.status(401).send({ error: 'AI 服务认证失败', message: error.message })
        }

        if (error instanceof Error && error.name === 'DeepSeekRateLimitError') {
          return reply.status(429).send({ error: 'AI 服务请求受限', message: error.message })
        }

        return reply.status(500).send({ error: '提示词优化失败' })
      }
    }
  )
}
