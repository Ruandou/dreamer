import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { verifyCharacterImageOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { imageQueue } from '../queues/image.js'

function buildStyledPrompt(visualStyle: string[] | undefined, core: string): string {
  const vs = (visualStyle || []).filter(Boolean).join(', ')
  if (!vs) return core
  return `Visual style: ${vs}. ${core}`
}

export async function characterImageRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { id: string }; Body: { prompt?: string } }>(
    '/:id/generate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const characterImageId = request.params.id
      const bodyPrompt = request.body?.prompt

      if (!(await verifyCharacterImageOwnership(userId, characterImageId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const image = await prisma.characterImage.findUnique({
        where: { id: characterImageId },
        include: {
          character: { include: { project: true } },
          parent: true
        }
      })

      if (!image) {
        return reply.status(404).send({ error: 'Character image not found' })
      }

      const project = image.character.project
      let effectivePrompt =
        typeof bodyPrompt === 'string' && bodyPrompt.trim()
          ? bodyPrompt.trim()
          : (image.prompt || '').trim()

      if (bodyPrompt !== undefined && bodyPrompt.trim()) {
        await prisma.characterImage.update({
          where: { id: characterImageId },
          data: { prompt: bodyPrompt.trim() }
        })
        effectivePrompt = bodyPrompt.trim()
      }

      if (!effectivePrompt) {
        return reply.status(400).send({ error: '缺少提示词：请在形象中填写 prompt 或传入 prompt' })
      }

      const finalPrompt = buildStyledPrompt(project.visualStyle, effectivePrompt)

      if (!image.parentId) {
        const job = await imageQueue.add('character-base', {
          kind: 'character_base_regenerate',
          userId,
          projectId: project.id,
          characterImageId: image.id,
          prompt: finalPrompt
        })
        return reply.status(202).send({ jobId: job.id, kind: 'character_base_regenerate' })
      }

      const parent = image.parent
      if (!parent?.avatarUrl) {
        return reply
          .status(400)
          .send({ error: '父级基础形象尚未生成，无法做换装/衍生图' })
      }

      const job = await imageQueue.add('character-derived', {
        kind: 'character_derived_regenerate',
        userId,
        projectId: project.id,
        characterImageId: image.id,
        referenceImageUrl: parent.avatarUrl,
        editPrompt: finalPrompt
      })
      return reply.status(202).send({ jobId: job.id, kind: 'character_derived_regenerate' })
    }
  )
}
