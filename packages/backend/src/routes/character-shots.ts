import { FastifyInstance } from 'fastify'
import { verifyCharacterShotOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { characterShotService } from '../services/character-shot-service.js'

export async function characterShotsRoutes(fastify: FastifyInstance) {
  fastify.patch<{ Params: { id: string }; Body: { characterImageId: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const id = request.params.id
      const { characterImageId } = request.body

      if (!(await verifyCharacterShotOwnership(userId, id))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      if (!characterImageId?.trim()) {
        return reply.status(400).send({ error: 'characterImageId required' })
      }

      const result = await characterShotService.updateCharacterImage(id, characterImageId.trim())

      if (!result.ok) {
        if (result.reason === 'not_found') {
          return reply.status(404).send({ error: 'CharacterShot not found' })
        }
        if (result.reason === 'image_not_found') {
          return reply.status(404).send({ error: 'CharacterImage not found' })
        }
        if (result.reason === 'character_mismatch') {
          return reply.status(400).send({ error: '形象必须属于该镜头中的同一角色' })
        }
        return reply.status(400).send({ error: 'Update failed' })
      }

      return result.characterShot
    }
  )
}
