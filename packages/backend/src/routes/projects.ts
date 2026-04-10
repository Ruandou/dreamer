import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = (request as any).user
      return prisma.project.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      })
    }
  )

  // Get project
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: user.id },
        include: {
          episodes: { include: { scenes: true } },
          characters: true,
          compositions: true
        }
      })

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      return project
    }
  )

  // Create project
  fastify.post<{ Body: { name: string; description?: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const { name, description } = request.body

      const project = await prisma.project.create({
        data: { name, description, userId: user.id }
      })

      return reply.status(201).send(project)
    }
  )

  // Update project
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const { name, description } = request.body

      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: user.id }
      })

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      return prisma.project.update({
        where: { id: request.params.id },
        data: { name, description }
      })
    }
  )

  // Delete project
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user

      const project = await prisma.project.findFirst({
        where: { id: request.params.id, userId: user.id }
      })

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' })
      }

      await prisma.project.delete({ where: { id: request.params.id } })

      return reply.status(204).send()
    }
  )
}
