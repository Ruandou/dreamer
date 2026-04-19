import { FastifyInstance } from 'fastify'
import { settingsService } from '../services/settings-service.js'
import { getRequestUser } from '../plugins/auth.js'

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get user settings
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = getRequestUser(request)
    return settingsService.getMePayload(user.id)
  })

  // Update user settings
  fastify.put<{
    Body: {
      name?: string
      apiKey?: string
      apiKeys?: {
        deepseekApiUrl?: string
        atlasApiKey?: string
        atlasApiUrl?: string
        arkApiKey?: string
        arkApiUrl?: string
      }
    }
  }>('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = getRequestUser(request)

    try {
      return await settingsService.updateMe(user.id, request.body)
    } catch (error) {
      console.error('Failed to update user settings:', error)
      return reply.status(500).send({ error: '更新设置失败' })
    }
  })

  // Verify API key (test connection)
  fastify.post<{ Body: { apiKey: string } }>(
    '/verify-api-key',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { apiKey } = request.body

      const result = await settingsService.verifyApiKey(apiKey)
      if (!result.ok) {
        if (result.empty) {
          return reply.status(400).send({ error: 'API Key 不能为空' })
        }
        return reply.status(400).send({
          valid: false,
          error: result.error
        })
      }

      return {
        valid: true,
        balance: result.balance
      }
    }
  )
}
