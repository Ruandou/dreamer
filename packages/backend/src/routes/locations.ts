import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { verifyLocationOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { imageQueue } from '../queues/image.js'

function buildStyledPrompt(visualStyle: string[] | undefined, core: string): string {
  const vs = (visualStyle || []).filter(Boolean).join(', ')
  if (!vs) return core
  return `Visual style: ${vs}. ${core}`
}

export async function locationRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId } = request.query

      if (!projectId) {
        return reply.status(400).send({ error: '缺少 projectId' })
      }

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return prisma.location.findMany({
        where: { projectId },
        orderBy: { name: 'asc' }
      })
    }
  )

  fastify.put<{
    Params: { id: string }
    Body: {
      timeOfDay?: string | null
      description?: string | null
      imagePrompt?: string | null
      characters?: string[]
    }
  }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const locationId = request.params.id

    if (!(await verifyLocationOwnership(userId, locationId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const { timeOfDay, description, imagePrompt, characters } = request.body
    const data: Record<string, unknown> = {}
    if (timeOfDay !== undefined) data.timeOfDay = timeOfDay
    if (description !== undefined) data.description = description
    if (imagePrompt !== undefined) data.imagePrompt = imagePrompt
    if (characters !== undefined) {
      if (!Array.isArray(characters)) {
        return reply.status(400).send({ error: 'characters 须为字符串数组' })
      }
      data.characters = characters
    }

    if (Object.keys(data).length === 0) {
      const loc = await prisma.location.findUnique({ where: { id: locationId } })
      return loc || reply.status(404).send({ error: 'Location not found' })
    }

    return prisma.location.update({
      where: { id: locationId },
      data
    })
  })

  fastify.post<{ Params: { id: string }; Body: { prompt?: string } }>(
    '/:id/generate-image',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const locationId = request.params.id
      const override = request.body?.prompt

      if (!(await verifyLocationOwnership(userId, locationId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const location = await prisma.location.findUnique({
        where: { id: locationId },
        include: { project: true }
      })

      if (!location) {
        return reply.status(404).send({ error: 'Location not found' })
      }

      let effective =
        typeof override === 'string' && override.trim()
          ? override.trim()
          : (location.imagePrompt || '').trim()

      if (typeof override === 'string' && override.trim()) {
        await prisma.location.update({
          where: { id: locationId },
          data: { imagePrompt: override.trim() }
        })
        effective = override.trim()
      }

      if (!effective) {
        return reply
          .status(400)
          .send({ error: '缺少定场图提示词：请填写 imagePrompt 或传入 prompt' })
      }

      const establishingName = `${location.name} establishing shot, cinematic lighting`
      const finalPrompt = buildStyledPrompt(
        location.project.visualStyle,
        `${establishingName}. ${effective}`
      )

      const job = await imageQueue.add('location-establishing', {
        kind: 'location_establishing',
        userId,
        projectId: location.projectId,
        locationId: location.id,
        prompt: finalPrompt
      })

      return reply.status(202).send({ jobId: job.id, kind: 'location_establishing' })
    }
  )
}
