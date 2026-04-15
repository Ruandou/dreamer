import { FastifyInstance } from 'fastify'
import { verifyEpisodeOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { episodeService } from '../services/episode-service.js'
import { enqueueEpisodeStoryboardScriptJob } from '../services/episode-storyboard-job.js'

export async function episodeRoutes(fastify: FastifyInstance) {
  // List episodes for a project
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return episodeService.listByProject(projectId)
    }
  )

  // Get episode
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const episode = await episodeService.getById(episodeId)

      if (!episode) {
        return reply.status(404).send({ error: 'Episode not found' })
      }

      return episode
    }
  )


  /** 集详情工作台：episode + scenes 全量树 + project.visualStyle */
  fastify.get<{ Params: { id: string } }>(
    '/:id/detail',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const detail = await episodeService.getEpisodeDetail(episodeId)

      if (!detail) {
        return reply.status(404).send({ error: 'Episode not found' })
      }

      return detail
    }
  )

  /** 分集管理：场次 + 定场 + 多镜 + CharacterShot + 台词 + takes */
  fastify.get<{ Params: { id: string } }>(
    '/:id/scenes',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const scenes = await episodeService.listScenesForEpisode(episodeId)
      return { scenes }
    }
  )

  // Create episode
  fastify.post<{ Body: { projectId: string; episodeNum: number; title?: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId, episodeNum, title } = request.body

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const episode = await episodeService.createEpisode(projectId, episodeNum, title)

      return reply.status(201).send(episode)
    }
  )

  // Update episode (including script content)
  fastify.put<{
    Params: { id: string }
    Body: { title?: string; synopsis?: string | null; script?: unknown }
  }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return episodeService.updateEpisode(episodeId, request.body)
    }
  )

  // Delete episode
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const deleted = await episodeService.deleteEpisodeIfExists(episodeId)
      if (!deleted) {
        return reply.status(404).send({ error: 'Episode not found' })
      }

      return reply.status(204).send()
    }
  )

  /** 按当前集场次与已选 Take 写入时间线并导出成片（复用 Composition + ffmpeg） */
  fastify.post<{ Params: { id: string }; Body: { title?: string } }>(
    '/:id/compose',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id
      const titleOverride = request.body?.title

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await episodeService.composeEpisode(episodeId, titleOverride)

      if (!result.ok) {
        if (result.status === 400 && 'details' in result && result.details) {
          return reply.status(400).send({ error: result.error, details: result.details })
        }
        if ('compositionId' in result && result.compositionId !== undefined) {
          return reply.status(result.status).send({
            error: result.error,
            compositionId: result.compositionId
          })
        }
        return reply.status(result.status).send({ error: result.error })
      }

      return {
        compositionId: result.compositionId,
        outputUrl: result.outputUrl,
        duration: result.duration,
        message: '合成完成'
      }
    }
  )

  // Expand script with AI (DeepSeek)
  fastify.post<{ Params: { id: string }; Body: { summary: string } }>(
    '/:id/expand',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { summary } = request.body
      const episodeId = request.params.id

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await episodeService.expandEpisodeScript(userId, episodeId, summary)

      if (!result.ok) {
        if (result.status === 404) {
          return reply.status(404).send({ error: result.error })
        }
        return reply.status(result.status).send({
          error: result.error,
          message: result.message
        })
      }

      return {
        episode: result.episode,
        script: result.script,
        scenesCreated: result.scenesCreated,
        aiCost: result.aiCost
      }
    }
  )

  /** 根据本集梗概与/或已有剧本，AI 生成分镜剧本并写入场次（Scene + 首镜） */
  fastify.post<{ Params: { id: string }; Body: { hint?: string } }>(
    '/:id/generate-storyboard-script',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const episodeId = request.params.id
      const hint = request.body?.hint

      if (!(await verifyEpisodeOwnership(userId, episodeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await enqueueEpisodeStoryboardScriptJob(userId, episodeId, hint)

      if (!result.ok) {
        if (result.status === 404) {
          return reply.status(404).send({ error: result.error })
        }
        if (result.status === 400) {
          return reply.status(400).send({
            error: result.error,
            message: result.message
          })
        }
        if (result.status === 409) {
          return reply.status(409).send({ error: result.error })
        }
        return reply.status(result.status).send({
          error: result.error
        })
      }

      return {
        jobId: result.jobId,
        message: '分镜剧本生成任务已提交，可在任务中心查看进度'
      }
    }
  )
}
