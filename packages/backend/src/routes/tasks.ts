import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { verifyTaskOwnership, verifyProjectOwnership } from '../plugins/auth.js'

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this task' })
      }

      const task = await prisma.take.findUnique({
        where: { id: taskId }
      })

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
      const userId = (request as any).user.id
      const { projectId } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
      }

      const scenes = await prisma.scene.findMany({
        where: {
          episode: { projectId }
        },
        include: {
          takes: true
        }
      })

      const tasks = scenes.flatMap((scene) =>
        scene.takes.map((task) => ({
          ...task,
          sceneNum: scene.sceneNum,
          sceneDescription: scene.description
        }))
      )

      return tasks.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/:id/cancel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this task' })
      }

      const task = await prisma.take.findUnique({
        where: { id: taskId }
      })

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' })
      }

      if (task.status === 'completed' || task.status === 'failed') {
        return reply.status(400).send({ error: 'Cannot cancel a completed or failed task' })
      }

      const updatedTask = await prisma.take.update({
        where: { id: taskId },
        data: { status: 'failed', errorMsg: 'Cancelled by user' }
      })

      await prisma.scene.update({
        where: { id: task.sceneId },
        data: { status: 'pending' }
      })

      return updatedTask
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/:id/retry',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const taskId = request.params.id

      if (!(await verifyTaskOwnership(userId, taskId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this task' })
      }

      const task = await prisma.take.findUnique({
        where: { id: taskId }
      })

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' })
      }

      if (task.status !== 'failed') {
        return reply.status(400).send({ error: 'Can only retry failed tasks' })
      }

      const newTask = await prisma.take.create({
        data: {
          sceneId: task.sceneId,
          model: task.model,
          status: 'queued',
          prompt: task.prompt
        }
      })

      await prisma.scene.update({
        where: { id: task.sceneId },
        data: { status: 'generating' }
      })

      const { videoQueue } = await import('../queues/video.js')
      await videoQueue.add('generate-video', {
        sceneId: task.sceneId,
        taskId: newTask.id,
        prompt: task.prompt,
        model: task.model as 'wan2.6' | 'seedance2.0'
      })

      return newTask
    }
  )
}
