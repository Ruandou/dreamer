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

function locationHasEstablishingImage(imageUrl: string | null | undefined): boolean {
  return !!(imageUrl && String(imageUrl).trim())
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

  /** 须在 /:id 之前注册，否则会被当成 id。仅对尚未有定场图（无 imageUrl）的场地入队。 */
  fastify.post<{
    Body: { projectId: string }
  }>('/batch-generate-images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const body = request.body || {}
    const projectId = body.projectId

    if (!projectId || typeof projectId !== 'string') {
      return reply.status(400).send({ error: '缺少 projectId' })
    }

    if (!(await verifyProjectOwnership(userId, projectId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const rows = await prisma.location.findMany({
      where: { projectId },
      include: { project: true },
      orderBy: { name: 'asc' }
    })

    const jobIds: string[] = []
    const enqueuedLocationIds: string[] = []
    const skipped: { id: string; name: string; reason: string }[] = []

    for (const location of rows) {
      if (locationHasEstablishingImage(location.imageUrl)) {
        skipped.push({ id: location.id, name: location.name, reason: '已有定场图' })
        continue
      }
      const effective = (location.imagePrompt || '').trim()
      if (!effective) {
        skipped.push({ id: location.id, name: location.name, reason: '缺少定场图提示词' })
        continue
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
      if (job.id) {
        jobIds.push(String(job.id))
        enqueuedLocationIds.push(location.id)
      }
    }

    return reply.status(202).send({
      jobIds,
      enqueuedLocationIds,
      skipped,
      enqueued: jobIds.length
    })
  })

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
