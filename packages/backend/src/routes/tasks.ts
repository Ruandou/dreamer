import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { verifyTaskOwnership, verifyProjectOwnership } from '../plugins/auth.js'

export async function taskRoutes(fastify: FastifyInstance) {
  // Get task by ID
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this task' })
      }

      const task = await prisma.videoTask.findUnique({
        where: { id: taskId }
      })

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' })
      }

      return task
    }
  )

  // List tasks by project
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId } = request.query

      // Verify project ownership
      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
      }

      const segments = await prisma.segment.findMany({
        where: {
          episode: { projectId }
        },
        include: {
          tasks: true
        }
      })

      const tasks = segments.flatMap((segment: any) =>
        segment.tasks.map((task: any) => ({
          ...task,
          segmentNum: segment.segmentNum,
          segmentDescription: segment.description
        }))
      )

      return tasks.sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    }
  )

  // Cancel task
  fastify.post<{ Params: { id: string } }>(
    '/:id/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this task' })
      }

      const task = await prisma.videoTask.findUnique({
        where: { id: taskId }
      })

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' })
      }

      if (task.status === 'completed' || task.status === 'failed') {
        return reply.status(400).send({ error: 'Cannot cancel a completed or failed task' })
      }

      // Update task status
      const updatedTask = await prisma.videoTask.update({
        where: { id: taskId },
        data: { status: 'failed', errorMsg: 'Cancelled by user' }
      })

      // Update segment status back to pending
      await prisma.segment.update({
        where: { id: task.segmentId },
        data: { status: 'pending' }
      })

      return updatedTask
    }
  )

  // Retry failed task
  fastify.post<{ Params: { id: string } }>(
    '/:id/retry',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this task' })
      }

      const task = await prisma.videoTask.findUnique({
        where: { id: taskId }
      })

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' })
      }

      if (task.status !== 'failed') {
        return reply.status(400).send({ error: 'Can only retry failed tasks' })
      }

      // Create a new task as retry
      const newTask = await prisma.videoTask.create({
        data: {
          segmentId: task.segmentId,
          model: task.model,
          status: 'queued',
          prompt: task.prompt
        }
      })

      // Update segment status
      await prisma.segment.update({
        where: { id: task.segmentId },
        data: { status: 'generating' }
      })

      // Re-add to queue
      const { videoQueue } = await import('../queues/video.js')
      await videoQueue.add('generate-video', {
        segmentId: task.segmentId,
        taskId: newTask.id,
        prompt: task.prompt,
        model: task.model as 'wan2.6' | 'seedance2.0'
      })

      return newTask
    }
  )
}
