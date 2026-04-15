import { FastifyInstance } from 'fastify'
import { verifyShotOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { characterShotService } from '../services/character-shot-service.js'

export async function shotRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Params: { shotId: string }
    Body: { characterImageId: string; action?: string | null }
  }>(
    '/:shotId/character-shots',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { shotId } = request.params
      const { characterImageId, action } = request.body

      if (!(await verifyShotOwnership(userId, shotId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      if (!characterImageId?.trim()) {
        return reply.status(400).send({ error: 'characterImageId required' })
      }

      const result = await characterShotService.createForShot(shotId, characterImageId.trim(), action)

      if (!result.ok) {
        if (result.reason === 'shot_not_found') {
          return reply.status(404).send({ error: 'Shot not found' })
        }
        if (result.reason === 'image_not_found') {
          return reply.status(404).send({ error: 'CharacterImage not found' })
        }
        if (result.reason === 'project_mismatch') {
          return reply.status(400).send({ error: '形象不属于该剧集项目' })
        }
        if (result.reason === 'duplicate') {
          return reply.status(409).send({ error: '该镜头已关联此形象' })
        }
        return reply.status(400).send({ error: 'Create failed' })
      }

      return reply.status(201).send(result.characterShot)
    }
  )
}
