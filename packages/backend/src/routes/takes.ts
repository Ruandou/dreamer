import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { verifyTaskOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'

export async function takeRoutes(fastify: FastifyInstance) {
  fastify.patch<{ Params: { id: string } }>(
    '/:id/select',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const takeId = request.params.id

      if (!(await verifyTaskOwnership(userId, takeId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const existing = await prisma.take.findUnique({ where: { id: takeId } })
      if (!existing) {
        return reply.status(404).send({ error: 'Take not found' })
      }

      const sceneId = existing.sceneId

      await prisma.take.updateMany({
        where: { sceneId },
        data: { isSelected: false }
      })

      const task = await prisma.take.update({
        where: { id: takeId },
        data: { isSelected: true }
      })

      return task
    }
  )
}
