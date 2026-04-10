import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { uploadFile, generateFileKey } from '../services/storage.js'
import { verifyCharacterOwnership, verifyProjectOwnership } from '../plugins/auth.js'

export async function characterRoutes(fastify: FastifyInstance) {
  // List characters for a project (with images)
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this character' })
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
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this character' })
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this character' })
      }

      await prisma.character.delete({ where: { id: characterId } })
      return reply.status(204).send()
    }
  )

  // ===== Image Management =====

  // Add image to character
  fastify.post<{ Params: { id: string }; Body: { name: string; parentId?: string; type?: string; description?: string } }>(
    '/:id/images',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this character' })
      }

      const { name, parentId, type, description } = request.body

      // Get uploaded file
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' })
      }

      // Generate key and upload
      const key = generateFileKey('assets', data.filename)
      const buffer = await data.toBuffer()
      const avatarUrl = await uploadFile('assets', key, buffer, data.mimetype)

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

      return reply.status(201).send(image)
    }
  )

  // Update image
  fastify.put<{ Params: { id: string; imageId: string }; Body: { name?: string; type?: string; description?: string; order?: number } }>(
    '/:id/images/:imageId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { id: characterId, imageId } = request.params

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this character' })
      }

      const { name, type, description, order } = request.body

      const image = await prisma.characterImage.update({
        where: { id: imageId },
        data: { name, type, description, order }
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this character' })
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
        return reply.status(403).send({ error: 'Forbidden: You do not have access to this character' })
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
