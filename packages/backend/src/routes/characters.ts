import { FastifyInstance } from 'fastify'
import {
  verifyCharacterOwnership,
  verifyProjectOwnership,
  getRequestUser
} from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { characterService } from '../services/character-service.js'

export async function characterRoutes(fastify: FastifyInstance) {
  // List characters for a project (with images)
  fastify.get<{ Querystring: { projectId: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const { projectId } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      return characterService.listByProject(projectId)
    }
  )

  // Get character with images tree
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const character = await characterService.getWithImages(characterId)

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
      const userId = getRequestUser(request).id
      const { projectId, name, description } = request.body

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const character = await characterService.createCharacter(projectId, name, description)

      return reply.status(201).send(character)
    }
  )

  // Update character
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { name, description } = request.body

      return characterService.updateCharacter(characterId, { name, description })
    }
  )

  // Delete character
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const characterId = request.params.id

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      await characterService.deleteCharacter(characterId)
      return reply.status(204).send()
    }
  )

  // ===== Image Management =====

  // Add image to character（multipart 上传文件，或 JSON 仅建槽位并由 DeepSeek 写 prompt）
  fastify.post<{
    Params: { id: string }
    Body?: { name?: string; type?: string; description?: string; parentId?: string }
  }>('/:id/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUser(request).id
    const characterId = request.params.id

    if (!(await verifyCharacterOwnership(userId, characterId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const reqWithMultipart = request as { isMultipart?: () => boolean }
    const isMultipart =
      typeof reqWithMultipart.isMultipart === 'function' && reqWithMultipart.isMultipart()
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

      const result = await characterService.createImageSlotWithAiPrompt(characterId, userId, {
        name,
        type,
        description,
        parentId
      })

      if (!result.ok) {
        if (result.error === 'base_exists') {
          return reply.status(409).send({ error: '每个角色只能有一个基础形象（无父级的定妆槽）' })
        }
        if (result.error === 'invalid_parent') {
          return reply.status(400).send({ error: 'Invalid parentId' })
        }
        if (result.error === 'deepseek_auth') {
          return reply.status(401).send({ error: 'AI 服务认证失败', message: result.message })
        }
        if (result.error === 'deepseek_rate') {
          return reply.status(429).send({ error: 'AI 服务请求受限', message: result.message })
        }
        return reply.status(500).send({
          error: '生成提示词失败',
          message: result.message
        })
      }

      return reply.status(201).send(result.image)
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
        const value = await part.value
        if (part.fieldname === 'name') name = value as string
        else if (part.fieldname === 'parentId') parentId = (value as string) || undefined
        else if (part.fieldname === 'type') type = (value as string) || undefined
        else if (part.fieldname === 'description') description = (value as string) || undefined
      }
    }

    if (!fileBuffer) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    if (!name) {
      return reply.status(400).send({ error: 'Name is required' })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(fileMimeType)) {
      return reply
        .status(400)
        .send({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' })
    }

    const fileResult = await characterService.createImageFromUploadedFile({
      characterId,
      name,
      parentId,
      type,
      description,
      fileBuffer,
      fileMimeType
    })

    if (!fileResult.ok) {
      if (fileResult.error === 'base_exists') {
        return reply.status(409).send({ error: '每个角色只能有一个基础形象（无父级的定妆槽）' })
      }
      return reply.status(400).send({ error: '创建失败' })
    }

    return reply.status(201).send(fileResult.image)
  })

  // Update image
  fastify.put<{
    Params: { id: string; imageId: string }
    Body: {
      name?: string
      type?: string
      description?: string
      order?: number
      prompt?: string | null
    }
  }>('/:id/images/:imageId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUser(request).id
    const { id: characterId, imageId } = request.params

    if (!(await verifyCharacterOwnership(userId, characterId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const { name, type, description, order, prompt } = request.body

    return characterService.updateCharacterImage(imageId, {
      name,
      type,
      description,
      order,
      prompt
    })
  })

  // 为已有形象槽位上传/替换定妆图（multipart，字段名 file）
  fastify.post<{ Params: { id: string; imageId: string } }>(
    '/:id/images/:imageId/avatar',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const { id: characterId, imageId } = request.params

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
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
          fileBuffer = Buffer.concat(buffers)
          fileMimeType = part.mimetype
          break
        }
      }

      if (!fileBuffer) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      const result = await characterService.uploadAvatarForCharacterImage(
        characterId,
        imageId,
        fileBuffer,
        fileMimeType
      )

      if (!result.ok) {
        if (result.error === 'not_found') {
          return reply.status(404).send({ error: 'Image not found' })
        }
        return reply.status(400).send({
          error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
        })
      }

      return reply.send(result.image)
    }
  )

  // Delete image (and its children)
  fastify.delete<{ Params: { id: string; imageId: string } }>(
    '/:id/images/:imageId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const { id: characterId, imageId } = request.params

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const del = await characterService.deleteImageWithDescendants(characterId, imageId)

      if (!del.ok) {
        if (del.error === 'not_found') {
          return reply.status(404).send({ error: 'Image not found' })
        }
        return reply.status(400).send({ error: '基础形象不可删除' })
      }

      return reply.status(204).send()
    }
  )

  // Move image to new parent (re-parent)
  fastify.put<{ Params: { id: string; imageId: string }; Body: { parentId?: string } }>(
    '/:id/images/:imageId/move',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUser(request).id
      const { id: characterId, imageId } = request.params

      if (!(await verifyCharacterOwnership(userId, characterId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { parentId } = request.body

      const result = await characterService.moveCharacterImage(characterId, imageId, parentId)

      if (!result.ok) {
        return reply.status(400).send({ error: 'Cannot move image under its own descendant' })
      }

      return result.image
    }
  )
}
