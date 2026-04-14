import { FastifyInstance } from 'fastify'
import { verifyTaskOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { takeService } from '../services/take-service.js'

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

      const result = await takeService.selectTakeAsCurrent(takeId)
      if (!result.ok) {
        return reply.status(404).send({ error: 'Take not found' })
      }

      return result.task
    }
  )
}
