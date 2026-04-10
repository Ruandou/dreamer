import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { videoQueue } from '../queues/video.js'
import { optimizePrompt } from '../services/deepseek.js'

export async function sceneRoutes(fastify: FastifyInstance) {
  // List scenes for an episode
  fastify.get<{ Querystring: { episodeId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { episodeId } = request.query
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
      const scene = await prisma.scene.findUnique({
        where: { id: request.params.id },
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
      const { episodeId, sceneNum, description, prompt } = request.body

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
      const { description, prompt, sceneNum } = request.body

      const scene = await prisma.scene.update({
        where: { id: request.params.id },
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
      await prisma.scene.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    }
  )

  // Generate video for scene
  fastify.post<{ Params: { id: string }; Body: { model: string; referenceImage?: string; duration?: number } }>(
    '/:id/generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { model, referenceImage, duration } = request.body

      const scene = await prisma.scene.findUnique({
        where: { id: request.params.id }
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
  fastify.post<{ Body: { sceneIds: string[]; model: string; referenceImage?: string } }>(
    '/batch-generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sceneIds, model, referenceImage } = request.body

      const results = []

      for (const sceneId of sceneIds) {
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
          referenceImage
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
      const { id, taskId } = request.params

      // Unselect all other tasks for this scene
      await prisma.videoTask.updateMany({
        where: { sceneId: id },
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
    async (request) => {
      return prisma.videoTask.findMany({
        where: { sceneId: request.params.id },
        orderBy: { createdAt: 'desc' }
      })
    }
  )

  // Optimize prompt with AI
  fastify.post<{ Params: { id: string }; Body: { prompt?: string } }>(
    '/:id/optimize-prompt',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const sceneId = request.params.id
      const { prompt } = request.body

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: { episode: { include: { project: { include: { characters: true } } } }
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
        const optimizedPrompt = await optimizePrompt(targetPrompt, context)

        // Optionally update the scene with optimized prompt
        if (!prompt) {
          await prisma.scene.update({
            where: { id: sceneId },
            data: { prompt: optimizedPrompt }
          })
        }

        return { optimizedPrompt }
      } catch (error) {
        console.error('Prompt optimization failed:', error)
        return reply.status(500).send({ error: '提示词优化失败' })
      }
    }
  )
}
