import type { FastifyInstance } from 'fastify'
import { listModelApiCallsForUser } from '../services/ai/model-api-call-service.js'

export async function modelApiCallRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: {
      limit?: string
      offset?: string
      model?: string
      op?: string
      projectId?: string
      status?: string
    }
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as { user: { id: string } }).user.id
    const payload = await listModelApiCallsForUser(userId, request.query)
    return reply.send(payload)
  })
}
