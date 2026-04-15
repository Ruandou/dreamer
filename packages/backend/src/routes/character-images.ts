import { FastifyInstance } from 'fastify'
import { verifyCharacterImageOwnership, verifyProjectOwnership } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { characterImageService } from '../services/character-image-service.js'

export async function characterImageRoutes(fastify: FastifyInstance) {
  /** 须在 /:id 之前注册 */
  fastify.post<{ Body: { projectId: string } }>(
    '/batch-generate-missing-avatars',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const projectId = request.body?.projectId
      if (!projectId || typeof projectId !== 'string') {
        return reply.status(400).send({ error: '缺少 projectId' })
      }
      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }
      const result = await characterImageService.batchEnqueueMissingAvatars(userId, projectId)
      return reply.status(202).send(result)
    }
  )

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

      const result = await characterImageService.enqueueGenerate(userId, characterImageId, bodyPrompt)

      if (!result.ok) {
        if (result.reason === 'not_found') {
          return reply.status(404).send({ error: 'Character image not found' })
        }
        if (result.reason === 'missing_prompt') {
          return reply.status(400).send({ error: '缺少提示词：请在形象中填写 prompt 或传入 prompt' })
        }
        return reply
          .status(400)
          .send({ error: '父级基础形象尚未生成，无法做换装/衍生图' })
      }

      return reply.status(202).send({ jobId: result.jobId, kind: result.kind })
    }
  )
}
