import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { uploadFile, generateFileKey } from '../services/storage.js'

export async function characterRoutes(fastify: FastifyInstance) {
  // List characters for a project
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { projectId } = request.query
      return prisma.character.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' }
      })
    }
  )

  // Get character
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const character = await prisma.character.findUnique({
        where: { id: request.params.id }
      })

      if (!character) {
        return reply.status(404).send({ error: 'Character not found' })
      }

      return character
    }
  )

  // Create character
  fastify.post<{ Body: { projectId: string; name: string; description?: string; avatarUrl?: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { projectId, name, description, avatarUrl } = request.body

      const character = await prisma.character.create({
        data: { projectId, name, description, avatarUrl }
      })

      return reply.status(201).send(character)
    }
  )

  // Update character
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string; avatarUrl?: string; versions?: any } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { name, description, avatarUrl, versions } = request.body

      const character = await prisma.character.update({
        where: { id: request.params.id },
        data: { name, description, avatarUrl, versions }
      })

      return character
    }
  )

  // Delete character
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await prisma.character.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    }
  )

  // Upload avatar (定妆照)
  fastify.post<{ Params: { id: string } }>(
    '/:id/avatar',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const characterId = request.params.id

      const character = await prisma.character.findUnique({
        where: { id: characterId }
      })

      if (!character) {
        return reply.status(404).send({ error: 'Character not found' })
      }

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

      const avatarUrl = await uploadFile(
        'assets',
        key,
        buffer,
        data.mimetype
      )

      // Update character
      const updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: { avatarUrl }
      })

      return updatedCharacter
    }
  )

  // Upload character version (服装版本)
  fastify.post<{ Params: { id: string }; Body: { name: string; description?: string } }>(
    '/:id/versions',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const characterId = request.params.id
      const { name, description } = request.body

      const character = await prisma.character.findUnique({
        where: { id: characterId }
      })

      if (!character) {
        return reply.status(404).send({ error: 'Character not found' })
      }

      // Get uploaded file
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      // Generate key and upload
      const key = generateFileKey('assets', data.filename)
      const buffer = await data.toBuffer()

      const avatarUrl = await uploadFile(
        'assets',
        key,
        buffer,
        data.mimetype
      )

      // Add to versions
      const versions = (character.versions as any[]) || []
      versions.push({
        id: `v${Date.now()}`,
        name,
        description,
        avatarUrl
      })

      const updatedCharacter = await prisma.character.update({
        where: { id: characterId },
        data: { versions }
      })

      return updatedCharacter
    }
  )
}
