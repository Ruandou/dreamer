import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { uploadFile, generateFileKey } from '../services/storage.js'
import { verifyCharacterOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { generateCharacterSlotImagePrompt } from '../services/deepseek.js'

export async function characterRoutes(fastify: FastifyInstance) {
  // List characters for a project (with images)
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const characters = await prisma.character.findMany({
        where: { projectId },
        include: {
          images: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      })

      return characters
    }
  )

  // Get character with images tree
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          images: {
            orderBy: { order: 'asc' }
          }
        }
      })

      if (!character) {
        return reply.status(404).send({ error: 'Character not found' })
      }

      return character
    }
  )

  // Create character
  fastify.post<{ Body: { projectId: string; name: string; description?: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId, name, description } = request.body

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const character = await prisma.character.create({
        data: { projectId, name, description }
      })

      return reply.status(201).send(character)
    }
  )

  // Update character
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { name, description } = request.body

      const character = await prisma.character.update({
        where: { id: characterId },
        data: { name, description }
      })

      return character
    }
  )

  // Delete character
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      await prisma.character.delete({ where: { id: characterId } })
      return reply.status(204).send()
    }
  )

  // ===== Image Management =====

  // Add image to character（multipart 上传文件，或 JSON 仅建槽位并由 DeepSeek 写 prompt）
  fastify.post<{
    Params: { id: string }
    Body?: { name?: string; type?: string; description?: string; parentId?: string }
  }>(
    '/:id/images',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const isMultipart = typeof (request as any).isMultipart === 'function' && (request as any).isMultipart()
      if (!isMultipart) {
        const { name, type, description, parentId } = (request.body || {}) as {
          name?: string
          type?: string
          description?: string
          parentId?: string
        }
        if (!name?.trim()) {
          return reply.status(400).send({ error: 'Name is required' })
        }

        let parentSummary: string | null = null
        if (parentId) {
          const parent = await prisma.characterImage.findFirst({
            where: { id: parentId, characterId }
          })
          if (!parent) {
            return reply.status(400).send({ error: 'Invalid parentId' })
          }
          parentSummary = [parent.name, parent.description].filter(Boolean).join(' — ')
        }

        const character = await prisma.character.findUnique({ where: { id: characterId } })
        const slotType = type || 'base'

        try {
          const { prompt } = await generateCharacterSlotImagePrompt({
            characterName: character?.name || '',
            characterDescription: character?.description,
            slotName: name.trim(),
            slotType,
            slotDescription: description || null,
            parentSlotSummary: parentSummary
          })

          const maxOrder = await prisma.characterImage.aggregate({
            where: { characterId, parentId: parentId || null },
            _max: { order: true }
          })

          const image = await prisma.characterImage.create({
            data: {
              characterId,
              name: name.trim(),
              parentId: parentId || null,
              type: slotType,
              description,
              prompt,
              avatarUrl: null,
              order: (maxOrder._max.order || 0) + 1
            }
          })

          return reply.status(201).send(JSON.parse(JSON.stringify(image)))
        } catch (e: any) {
          if (e?.name === 'DeepSeekAuthError') {
            return reply.status(401).send({ error: 'AI 服务认证失败', message: e.message })
          }
          if (e?.name === 'DeepSeekRateLimitError') {
            return reply.status(429).send({ error: 'AI 服务请求受限', message: e.message })
          }
          return reply.status(500).send({
            error: '生成提示词失败',
            message: e instanceof Error ? e.message : '未知错误'
          })
        }
      }

      // Parse multipart form - collect fields first
      let name = ''
      let parentId: string | undefined
      let type: string | undefined
      let description: string | undefined
      let fileBuffer: Buffer | null = null
      let fileMimeType = ''

      const parts = request.parts()
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffers: Buffer[] = []
          for await (const chunk of part.file) {
            buffers.push(chunk)
          }
          fileBuffer = Buffer.concat(buffers)
          fileMimeType = part.mimetype
        } else {
          // field
          const value = await part.value
          if (part.fieldname === 'name') name = value as string
          else if (part.fieldname === 'parentId') parentId = value as string || undefined
          else if (part.fieldname === 'type') type = value as string || undefined
          else if (part.fieldname === 'description') description = value as string || undefined
        }
      }

      if (!fileBuffer) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      if (!name) {
        return reply.status(400).send({ error: 'Name is required' })
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(fileMimeType)) {
        return reply.status(400).send({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' })
      }

      // Generate key and upload
      const key = generateFileKey('assets', `upload_${Date.now()}.png`)
      const avatarUrl = await uploadFile('assets', key, fileBuffer, fileMimeType)

      // Get max order for siblings
      const maxOrder = await prisma.characterImage.aggregate({
        where: { characterId, parentId: parentId || null },
        _max: { order: true }
      })

      const image = await prisma.characterImage.create({
        data: {
          characterId,
          name,
          parentId: parentId || null,
          type: type || 'base',
          description,
          avatarUrl,
          order: (maxOrder._max.order || 0) + 1
        }
      })

      // Return plain object to avoid Prisma serialization issues with self-reference
      return reply.status(201).send(JSON.parse(JSON.stringify(image)))
    }
  )

  // Update image
  fastify.put<{
    Params: { id: string; imageId: string }
    Body: { name?: string; type?: string; description?: string; order?: number; prompt?: string | null }
  }>(
    '/:id/images/:imageId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { id: characterId, imageId } = request.params

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { name, type, description, order, prompt } = request.body

      const image = await prisma.characterImage.update({
        where: { id: imageId },
        data: { name, type, description, order, prompt }
      })

      return image
    }
  )

  // Delete image (and its children)
  fastify.delete<{ Params: { id: string; imageId: string } }>(
    '/:id/images/:imageId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { id: characterId, imageId } = request.params

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      // Delete children first (recursive)
      const deleteChildren = async (parentId: string) => {
        const children = await prisma.characterImage.findMany({
          where: { parentId }
        })
        for (const child of children) {
          await deleteChildren(child.id)
          await prisma.characterImage.delete({ where: { id: child.id } })
        }
      }

      await deleteChildren(imageId)
      await prisma.characterImage.delete({ where: { id: imageId } })

      return reply.status(204).send()
    }
  )

  // Move image to new parent (re-parent)
  fastify.put<{ Params: { id: string; imageId: string }; Body: { parentId?: string } }>(
    '/:id/images/:imageId/move',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { id: characterId, imageId } = request.params

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { parentId } = request.body

      // Prevent circular reference
      if (parentId) {
        const checkAncestor = async (id: string, targetId: string): Promise<boolean> => {
          if (id === targetId) return true
          const image = await prisma.characterImage.findUnique({ where: { id } })
          if (!image || !image.parentId) return false
          return checkAncestor(image.parentId, targetId)
        }

        if (await checkAncestor(parentId, imageId)) {
          return reply.status(400).send({ error: 'Cannot move image under its own descendant' })
        }
      }

      // Get max order for new siblings
      const maxOrder = await prisma.characterImage.aggregate({
        where: { characterId, parentId: parentId || null },
        _max: { order: true }
      })

      const image = await prisma.characterImage.update({
        where: { id: imageId },
        data: {
          parentId: parentId || null,
          order: (maxOrder._max.order || 0) + 1
        }
      })

      return image
    }
  )
}
