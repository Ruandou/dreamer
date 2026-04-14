import type { FastifyInstance } from 'fastify'
import { getApiCalls } from '../services/api-logger.js'

export async function modelApiCallRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { limit?: string; offset?: string; model?: string }
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as { user: { id: string } }).user.id
    const { limit, offset, model } = request.query
    const lim = limit != null && limit !== '' ? Math.min(200, Math.max(1, parseInt(limit, 10) || 50)) : 50
    const off = offset != null && offset !== '' ? Math.max(0, parseInt(offset, 10) || 0) : 0
    const rows = await getApiCalls(userId, {
      model: model?.trim() || undefined,
      limit: lim,
      offset: off
    })
    return reply.send({ items: rows, limit: lim, offset: off })
  })
}
