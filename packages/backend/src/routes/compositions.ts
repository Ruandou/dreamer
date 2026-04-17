import { FastifyInstance } from 'fastify'
import { verifyCompositionOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { compositionService } from '../services/composition-service.js'

export async function compositionRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return compositionService.listByProject(projectId)
    }
  )

  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const compositionId = request.params.id

      if (!(await verifyCompositionOwnership(userId, compositionId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const composition = await compositionService.getDetailEnriched(compositionId)

      if (!composition) {
        return reply.status(404).send({ error: 'Composition not found' })
      }

      return composition
    }
  )

  fastify.post<{ Body: { projectId: string; episodeId: string; title: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId, episodeId, title } = request.body

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const composition = await compositionService.create(projectId, episodeId, title)

      return reply.status(201).send(composition)
    }
  )

  fastify.put<{ Params: { id: string }; Body: { title?: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const compositionId = request.params.id

      if (!(await verifyCompositionOwnership(userId, compositionId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { title } = request.body

      return compositionService.updateTitle(compositionId, title)
    }
  )

  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const compositionId = request.params.id

      if (!(await verifyCompositionOwnership(userId, compositionId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const deleted = await compositionService.deleteIfExists(compositionId)
      if (!deleted) {
        return reply.status(404).send({ error: 'Composition not found' })
      }

      return reply.status(204).send()
    }
  )

  fastify.put<{
    Params: { id: string }
    Body: { clips: Array<{ sceneId: string; takeId: string; order: number }> }
  }>('/:id/timeline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const compositionId = request.params.id

    if (!(await verifyCompositionOwnership(userId, compositionId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const { clips } = request.body

    return compositionService.updateTimeline(compositionId, clips)
  })

  fastify.post<{ Params: { id: string } }>(
    '/:id/export',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const compositionId = request.params.id

      if (!(await verifyCompositionOwnership(userId, compositionId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await compositionService.exportComposition(compositionId)
      if (!result.ok) {
        if (result.httpStatus === 500) {
          return reply.status(500).send({
            error: 'Export failed',
            message: result.error
          })
        }
        return reply.status(result.httpStatus).send({ error: result.error })
      }

      return {
        message: 'Export completed',
        outputUrl: result.outputUrl,
        duration: result.duration
      }
    }
  )
}
