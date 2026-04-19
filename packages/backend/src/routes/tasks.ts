import { FastifyInstance } from 'fastify'
import { verifyTaskOwnership, verifyProjectOwnership, getRequestUser } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { taskService } from '../services/task-service.js'

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const task = await taskService.getById(taskId)

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' })
      }

      return task
    }
  )

  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const { projectId } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return taskService.listByProject(projectId)
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/:id/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await taskService.cancelTask(taskId)
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return result.task
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/:id/retry',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const result = await taskService.retryTask(taskId)
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }

      return result.task
    }
  )
}
