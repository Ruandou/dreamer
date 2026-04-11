import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { videoQueue } from '../queues/video.js'
import { optimizePrompt } from '../services/deepseek.js'
import { verifySceneOwnership, verifyEpisodeOwnership } from '../plugins/auth.js'
import type { VideoModel } from '@dreamer/shared/types'

export async function sceneRoutes(fastify: FastifyInstance) {
  // List scenes for an episode
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

      return prisma.scene.findMany({
        where: { episodeId },
        orderBy: { sceneNum: 'asc' },
        include: {
          tasks: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    }
  )

  // Get scene
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: { tasks: { orderBy: { createdAt: 'desc' } } }
      })

      if (!scene) {
        return reply.status(404).send({ error: 'Scene not found' })
      }

      return scene
    }
  )

  // Create scene
  fastify.post<{ Body: { episodeId: string; sceneNum: number; description?: string; prompt: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { episodeId, sceneNum, description, prompt } = request.body

      // Verify episode ownership
      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
      }

      const scene = await prisma.scene.create({
        data: { episodeId, sceneNum, description, prompt }
      })

      return reply.status(201).send(scene)
    }
  )

  // Update scene
  fastify.put<{ Params: { id: string }; Body: { description?: string; prompt?: string; sceneNum?: number } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      const { description, prompt, sceneNum } = request.body

      const scene = await prisma.scene.update({
        where: { id: sceneId },
        data: { description, prompt, ...(sceneNum !== undefined && { sceneNum }) }
      })

      return scene
    }
  )

  // Delete scene
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      const scene = await prisma.scene.findUnique({ where: { id: sceneId } })
      if (!scene) {
        return reply.status(404).send({ error: 'Scene not found' })
      }

      await prisma.scene.delete({ where: { id: sceneId } })
      return reply.status(204).send()
    }
  )

  // Generate video for scene
  fastify.post<{ Params: { id: string }; Body: { model: VideoModel; referenceImage?: string; imageUrls?: string[]; duration?: number } }>(
    '/:id/generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      const { model, referenceImage, imageUrls, duration } = request.body

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId }
      })

      if (!scene) {
        return reply.status(404).send({ error: 'Scene not found' })
      }

      // Create video task
      const task = await prisma.videoTask.create({
        data: {
          sceneId: scene.id,
          model,
          status: 'queued',
          prompt: scene.prompt
        }
      })

      // Add to queue
      await videoQueue.add('generate-video', {
        sceneId: scene.id,
        taskId: task.id,
        prompt: scene.prompt,
        model,
        referenceImage,
        imageUrls,
        duration
      })

      // Update scene status
      await prisma.scene.update({
        where: { id: scene.id },
        data: { status: 'processing' }
      })

      return { taskId: task.id, sceneId: scene.id }
    }
  )

  // Batch generate videos
  fastify.post<{ Body: { sceneIds: string[]; model: VideoModel; referenceImage?: string; imageUrls?: string[] } }>(
    '/batch-generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { sceneIds, model, referenceImage, imageUrls } = request.body

      const results = []

      for (const sceneId of sceneIds) {
        // Verify ownership for each scene
        if (!(await verifySceneOwnership(userId, sceneId))) {
          continue
        }

        const scene = await prisma.scene.findUnique({ where: { id: sceneId } })
        if (!scene) continue

        const task = await prisma.videoTask.create({
          data: {
            sceneId,
            model,
            status: 'queued',
            prompt: scene.prompt
          }
        })

        await videoQueue.add('generate-video', {
          sceneId: scene.id,
          taskId: task.id,
          prompt: scene.prompt,
          model,
          referenceImage,
          imageUrls
        })

        await prisma.scene.update({
          where: { id: scene.id },
          data: { status: 'processing' }
        })

        results.push({ sceneId, taskId: task.id })
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
      const { id: sceneId, taskId } = request.params

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      // Unselect all other tasks for this scene
      await prisma.videoTask.updateMany({
        where: { sceneId },
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

  // Get all tasks for a scene
  fastify.get<{ Params: { id: string } }>(
    '/:id/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      return prisma.videoTask.findMany({
        where: { sceneId },
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
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      const { prompt } = request.body

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: { episode: { include: { project: { include: { characters: true } } } } }
      })

      if (!scene) {
        return reply.status(404).send({ error: 'Scene not found' })
      }

      const targetPrompt = prompt || scene.prompt

      // Build context with characters
      const characters = scene.episode.project.characters
      const context = characters.length > 0
        ? `角色设定：${characters.map(c => `${c.name}: ${c.description || '未描述'}`).join('; ')}`
        : undefined

      try {
        const { optimized, cost } = await optimizePrompt(targetPrompt, context)

        // Optionally update the scene with optimized prompt
        if (!prompt) {
          await prisma.scene.update({
            where: { id: sceneId },
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
