import type { Prisma } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { uploadFile, generateFileKey } from '../services/storage.js'
import { verifyLocationOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { locationService } from '../services/location-service.js'

const LOCATION_IMAGE_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

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

      return locationService.listByProject(projectId)
    }
  )

  fastify.post<{
    Body: { projectId?: string; name?: string; timeOfDay?: string | null; description?: string | null }
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const projectId = request.body?.projectId
    const name = request.body?.name

    if (!projectId || typeof projectId !== 'string') {
      return reply.status(400).send({ error: '缺少 projectId' })
    }
    if (!(await verifyProjectOwnership(userId, projectId))) {
      return reply.status(403).send(permissionDeniedBody)
    }
    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: '缺少场地名称' })
    }

    const result = await locationService.createManual(projectId, {
      name,
      timeOfDay: request.body?.timeOfDay,
      description: request.body?.description
    })

    if (!result.ok) {
      if (result.reason === 'empty_name') {
        return reply.status(400).send({ error: '场地名称不能为空' })
      }
      return reply.status(409).send({ error: '已存在同名称场地' })
    }

    return reply.status(201).send(result.location)
  })

  /** 须在 /:id 之前注册，否则会被当成 id。仅对尚未有定场图（无 imageUrl）的场地入队。 */
  fastify.post<{
    Body: { projectId: string; promptOverrides?: Record<string, string> }
  }>('/batch-generate-images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const body = request.body || {}
    const projectId = body.projectId
    const promptOverrides =
      body.promptOverrides &&
      typeof body.promptOverrides === 'object' &&
      !Array.isArray(body.promptOverrides)
        ? (body.promptOverrides as Record<string, string>)
        : undefined

    if (!projectId || typeof projectId !== 'string') {
      return reply.status(400).send({ error: '缺少 projectId' })
    }

    if (!(await verifyProjectOwnership(userId, projectId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const result = await locationService.batchEnqueueEstablishingImages(
      userId,
      projectId,
      promptOverrides
    )
    return reply.status(202).send(result)
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
      const loc = await locationService.findActiveById(locationId)
      return loc || reply.status(404).send({ error: 'Location not found' })
    }

    return locationService.updateFields(locationId, data as Prisma.LocationUpdateInput)
  })

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.id
    const locationId = request.params.id

    if (!(await verifyLocationOwnership(userId, locationId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const deleted = await locationService.deleteLocation(locationId)
    if (!deleted) {
      return reply.status(404).send({ error: 'Location not found' })
    }
    return reply.status(204).send()
  })

  /** 本地上传定场图（multipart，字段名 file） */
  fastify.post<{ Params: { id: string } }>(
    '/:id/image',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const locationId = request.params.id

      if (!(await verifyLocationOwnership(userId, locationId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      if (!(await locationService.findActiveById(locationId))) {
        return reply.status(404).send({ error: 'Location not found' })
      }

      const isMultipart =
        typeof (request as any).isMultipart === 'function' && (request as any).isMultipart()
      if (!isMultipart) {
        return reply.status(400).send({ error: '请使用 multipart 上传，字段名 file' })
      }

      let fileBuffer: Buffer | null = null
      let fileMimeType = ''

      const parts = request.parts()
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffers: Buffer[] = []
          for await (const chunk of part.file) {
            buffers.push(chunk)
          }
          const buf = Buffer.concat(buffers)
          if (!fileBuffer) {
            fileBuffer = buf
            fileMimeType = part.mimetype
          }
        }
      }

      if (!fileBuffer) {
        return reply.status(400).send({ error: '未上传文件' })
      }

      if (!(LOCATION_IMAGE_UPLOAD_TYPES as readonly string[]).includes(fileMimeType)) {
        return reply.status(400).send({ error: '仅支持 JPEG、PNG、WebP' })
      }

      const ext =
        fileMimeType === 'image/jpeg' ? 'jpg' : fileMimeType === 'image/png' ? 'png' : 'webp'
      const key = generateFileKey('assets', `location_${locationId}_${Date.now()}.${ext}`)
      const imageUrl = await uploadFile('assets', key, fileBuffer, fileMimeType)

      const updated = await locationService.setUploadedImageAndClearCost(locationId, imageUrl)

      return reply.status(200).send(updated)
    }
  )

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

      const result = await locationService.enqueueEstablishingForLocation(
        userId,
        locationId,
        typeof override === 'string' ? override : undefined
      )

      if (!result.ok) {
        if (result.reason === 'not_found') {
          return reply.status(404).send({ error: 'Location not found' })
        }
        return reply
          .status(400)
          .send({ error: '缺少定场图提示词：请填写 imagePrompt 或传入 prompt' })
      }

      return reply.status(202).send({ jobId: result.jobId, kind: result.kind })
    }
  )
}
