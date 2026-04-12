import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { videoQueue } from '../queues/video.js'
import { optimizePrompt } from '../services/deepseek.js'
import { verifySceneOwnership, verifyEpisodeOwnership } from '../plugins/auth.js'
import type { VideoModel } from '@dreamer/shared/types'
import { stitchScenePrompt } from '../services/scene-prompt.js'

async function resolveSceneGeneratePrompt(sceneId: string): Promise<string> {
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: { shots: { orderBy: [{ order: 'asc' }, { shotNum: 'asc' }] } }
  })
  if (!scene) return ''
  const stitched = stitchScenePrompt(
    scene.shots.map((s) => ({
      shotNum: s.shotNum,
      order: s.order,
      description: s.description,
      cameraMovement: s.cameraMovement,
      cameraAngle: s.cameraAngle
    }))
  )
  if (stitched.trim()) return stitched
  return scene.description.trim() || ' '
}

export async function sceneRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { episodeId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { episodeId } = request.query

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
      }

      return prisma.scene.findMany({
        where: { episodeId },
        orderBy: { sceneNum: 'asc' },
        include: {
          takes: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    }
  )

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
        include: { takes: { orderBy: { createdAt: 'desc' } }, shots: { orderBy: { order: 'asc' } } }
      })

      if (!scene) {
        return reply.status(404).send({ error: 'Scene not found' })
      }

      return scene
    }
  )

  fastify.post<{ Body: { episodeId: string; sceneNum: number; description?: string; prompt: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { episodeId, sceneNum, description, prompt } = request.body

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this episode' })
      }

      const scene = await prisma.scene.create({
        data: {
          episodeId,
          sceneNum,
          description: description ?? '',
          duration: 5000,
          aspectRatio: '9:16',
          visualStyle: [],
          status: 'pending'
        }
      })

      await prisma.shot.create({
        data: {
          sceneId: scene.id,
          shotNum: 1,
          order: 1,
          description: prompt,
          duration: 5000
        }
      })

      return reply.status(201).send(scene)
    }
  )

  fastify.put<{ Params: { id: string }; Body: { description?: string; sceneNum?: number; prompt?: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      const { description, sceneNum, prompt } = request.body

      if (prompt !== undefined) {
        const firstShot = await prisma.shot.findFirst({
          where: { sceneId },
          orderBy: [{ order: 'asc' }, { shotNum: 'asc' }]
        })
        if (firstShot) {
          await prisma.shot.update({
            where: { id: firstShot.id },
            data: { description: prompt }
          })
        }
      }

      const scene = await prisma.scene.update({
        where: { id: sceneId },
        data: {
          ...(description !== undefined && { description }),
          ...(sceneNum !== undefined && { sceneNum })
        }
      })

      return scene
    }
  )

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

      const prompt = await resolveSceneGeneratePrompt(sceneId)
      if (!prompt.trim()) {
        return reply.status(400).send({ error: 'Scene has no prompt: add Shots or description' })
      }

      const task = await prisma.take.create({
        data: {
          sceneId,
          model,
          status: 'queued',
          prompt
        }
      })

      await videoQueue.add('generate-video', {
        sceneId,
        taskId: task.id,
        prompt,
        model,
        referenceImage,
        imageUrls,
        duration
      })

      await prisma.scene.update({
        where: { id: sceneId },
        data: { status: 'generating' }
      })

      return { taskId: task.id, sceneId }
    }
  )

  fastify.post<{ Body: { sceneIds: string[]; model: VideoModel; referenceImage?: string; imageUrls?: string[] } }>(
    '/batch-generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { sceneIds, model, referenceImage, imageUrls } = request.body

      const results: { sceneId: string; taskId: string }[] = []

      for (const sceneId of sceneIds) {
        if (!(await verifySceneOwnership(userId, sceneId))) {
          continue
        }

        const prompt = await resolveSceneGeneratePrompt(sceneId)
        if (!prompt.trim()) continue

        const task = await prisma.take.create({
          data: {
            sceneId,
            model,
            status: 'queued',
            prompt
          }
        })

        await videoQueue.add('generate-video', {
          sceneId,
          taskId: task.id,
          prompt,
          model,
          referenceImage,
          imageUrls
        })

        await prisma.scene.update({
          where: { id: sceneId },
          data: { status: 'generating' }
        })

        results.push({ sceneId, taskId: task.id })
      }

      return results
    }
  )

  fastify.post<{ Params: { id: string; taskId: string } }>(
    '/:id/tasks/:taskId/select',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { id: sceneId, taskId } = request.params

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      await prisma.take.updateMany({
        where: { sceneId },
        data: { isSelected: false }
      })

      const task = await prisma.take.update({
        where: { id: taskId },
        data: { isSelected: true }
      })

      return task
    }
  )

  fastify.get<{ Params: { id: string } }>(
    '/:id/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this scene' })
      }

      return prisma.take.findMany({
        where: { sceneId },
        orderBy: { createdAt: 'desc' }
      })
    }
  )

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
        include: {
          episode: { include: { project: { include: { characters: true } } } },
          shots: { orderBy: { order: 'asc' } }
        }
      })

      if (!scene) {
        return reply.status(404).send({ error: 'Scene not found' })
      }

      const targetPrompt =
        prompt ||
        (await resolveSceneGeneratePrompt(sceneId))

      const characters = scene.episode.project.characters
      const context =
        characters.length > 0
          ? `角色设定：${characters.map((c) => `${c.name}: ${c.description || '未描述'}`).join('; ')}`
          : undefined

      try {
        const { optimized, cost } = await optimizePrompt(targetPrompt, context)

        if (!prompt && scene.shots.length > 0) {
          const first = scene.shots[0]
          await prisma.shot.update({
            where: { id: first.id },
            data: { description: optimized }
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
