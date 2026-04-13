import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { runCompositionExport } from '../services/composition-export.js'
import { uploadFile, generateFileKey } from '../services/storage.js'
import { verifyCompositionOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'

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

      return prisma.composition.findMany({
        where: { projectId },
        include: { scenes: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' }
      })
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

      const composition = await prisma.composition.findUnique({
        where: { id: compositionId },
        include: {
          scenes: {
            orderBy: { order: 'asc' },
            include: { take: true, scene: true }
          }
        }
      })

      if (!composition) {
        return reply.status(404).send({ error: 'Composition not found' })
      }

      const enrichedScenes = composition.scenes.map((row) => ({
        ...row,
        videoUrl: row.take.videoUrl || null,
        thumbnailUrl: row.take.thumbnailUrl || null
      }))

      return {
        ...composition,
        scenes: enrichedScenes
      }
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

      const composition = await prisma.composition.create({
        data: { projectId, episodeId, title }
      })

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

      const composition = await prisma.composition.update({
        where: { id: compositionId },
        data: { title }
      })

      return composition
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

      const composition = await prisma.composition.findUnique({ where: { id: compositionId } })
      if (!composition) {
        return reply.status(404).send({ error: 'Composition not found' })
      }

      await prisma.composition.delete({ where: { id: compositionId } })
      return reply.status(204).send()
    }
  )

  fastify.put<{ Params: { id: string }; Body: { clips: Array<{ sceneId: string; takeId: string; order: number }> } }>(
    '/:id/timeline',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const compositionId = request.params.id

      if (!(await verifyCompositionOwnership(userId, compositionId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { clips } = request.body

      await prisma.compositionScene.deleteMany({ where: { compositionId } })

      if (clips.length > 0) {
        await prisma.compositionScene.createMany({
          data: clips.map((c) => ({
            compositionId,
            sceneId: c.sceneId,
            takeId: c.takeId,
            order: c.order
          }))
        })
      }

      return prisma.composition.findUnique({
        where: { id: compositionId },
        include: { scenes: { orderBy: { order: 'asc' } } }
      })
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/:id/export',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const compositionId = request.params.id

      if (!(await verifyCompositionOwnership(userId, compositionId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await runCompositionExport(compositionId)
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
