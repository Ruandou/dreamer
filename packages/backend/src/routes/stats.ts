import { FastifyInstance } from 'fastify'
import {
  statsService,
  type ProjectCostStats,
  type UserCostStats
} from '../services/stats-service.js'
import { getRequestUser } from '../plugins/auth.js'

export type { ProjectCostStats, UserCostStats }

export async function statsRoutes(fastify: FastifyInstance) {
  // Get cost statistics for a project
  fastify.get<{ Querystring: { projectId: string } }>(
    '/projects/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId } = request.query

      const stats = await statsService.getProjectCostStats(projectId)
      if (!stats) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      return stats
    }
  )

  // Get cost statistics for current user (all projects)
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = getRequestUser(request)
    return statsService.getUserCostStats(user.id)
  })

  // Get daily cost trend
  fastify.get<{ Querystring: { projectId?: string; days?: number } }>(
    '/trend',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = getRequestUser(request)
      const { projectId, days = 30 } = request.query

      return statsService.getCostTrend(user.id, projectId, days)
    }
  )

  // Get DeepSeek account balance
  fastify.get('/ai-balance', { preHandler: [fastify.authenticate] }, async () => {
    return statsService.getAiBalance()
  })
}
