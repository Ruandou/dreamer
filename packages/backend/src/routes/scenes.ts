import { FastifyInstance } from 'fastify'
import { verifySceneOwnership, verifyEpisodeOwnership } from '../plugins/auth.js'
import type { VideoModel } from '@dreamer/shared/types'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { sceneService } from '../services/scene-service.js'

export async function sceneRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { episodeId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { episodeId } = request.query

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return sceneService.listByEpisode(episodeId)
    }
  )

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const scene = await sceneService.getByIdWithTakesAndShots(sceneId)

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
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await sceneService.createSceneWithFirstShot(
        episodeId,
        sceneNum,
        prompt,
        description
      )

      if (!result.ok) {
        return reply.status(404).send({ error: 'Episode not found' })
      }

      return reply.status(201).send(result.scene)
    }
  )

  fastify.put<{ Params: { id: string }; Body: { description?: string; sceneNum?: number; prompt?: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return sceneService.updateScene(sceneId, request.body)
    }
  )

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const deleted = await sceneService.deleteSceneIfExists(sceneId)
      if (!deleted) {
        return reply.status(404).send({ error: 'Scene not found' })
      }
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
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await sceneService.enqueueVideoGenerate(sceneId, request.body)

      if (!result.ok) {
        return reply.status(400).send({ error: 'Scene has no prompt: add Shots or description' })
      }

      return { taskId: result.taskId, sceneId: result.sceneId }
    }
  )

  fastify.post<{ Body: { sceneIds: string[]; model: VideoModel; referenceImage?: string; imageUrls?: string[] } }>(
    '/batch-generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { sceneIds, model, referenceImage, imageUrls } = request.body

      const results = await sceneService.batchEnqueueVideoGenerate(
        userId,
        sceneIds,
        model,
        referenceImage,
        imageUrls,
        verifySceneOwnership
      )

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
        return reply.status(403).send(permissionDeniedBody)
      }

      return sceneService.selectTaskInScene(sceneId, taskId)
    }
  )

  fastify.get<{ Params: { id: string } }>(
    '/:id/tasks',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return sceneService.listTasksForScene(sceneId)
    }
  )

  fastify.post<{ Params: { id: string }; Body: { prompt?: string } }>(
    '/:id/optimize-prompt',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const sceneId = request.params.id

      if (!(await verifySceneOwnership(userId, sceneId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await sceneService.optimizeScenePrompt(sceneId, userId, request.body?.prompt)

      if (!result.ok) {
        if (result.reason === 'not_found') {
          return reply.status(404).send({ error: 'Scene not found' })
        }
        if (result.reason === 'deepseek_auth') {
          return reply.status(401).send({ error: 'AI 服务认证失败', message: result.message })
        }
        if (result.reason === 'deepseek_rate') {
          return reply.status(429).send({ error: 'AI 服务请求受限', message: result.message })
        }
        return reply.status(500).send({ error: '提示词优化失败' })
      }

      return { optimizedPrompt: result.optimizedPrompt, aiCost: result.aiCost }
    }
  )
}
