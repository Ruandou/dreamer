import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { getDeepSeekBalance } from '../services/deepseek.js'

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get user settings
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = (request as any).user

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          apiKey: true,
          atlasApiKey: true,
          atlasApiUrl: true,
          volcAccessKey: true,
          volcSecretKey: true,
          volcApiUrl: true,
          createdAt: true
        }
      })

      if (!dbUser) {
        return { error: 'User not found' }
      }

      // Check if API key is set
      const hasApiKey = !!dbUser.apiKey

      // Try to get balance if API key is set
      let balance = null
      let balanceError = null
      if (dbUser.apiKey) {
        try {
          // Temporarily set the API key to check balance
          const originalKey = process.env.DEEPSEEK_API_KEY
          process.env.DEEPSEEK_API_KEY = dbUser.apiKey
          balance = await getDeepSeekBalance()
          process.env.DEEPSEEK_API_KEY = originalKey
        } catch (error: any) {
          balanceError = error.message
          balance = null
        }
      }

      return {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          createdAt: dbUser.createdAt
        },
        hasApiKey,
        balance,
        balanceError,
        apiKeys: {
          atlasApiKey: dbUser.atlasApiKey,
          atlasApiUrl: dbUser.atlasApiUrl,
          volcAccessKey: dbUser.volcAccessKey,
          volcSecretKey: dbUser.volcSecretKey,
          volcApiUrl: dbUser.volcApiUrl
        }
      }
    }
  )

  // Update user settings
  fastify.put<{
    Body: {
      name?: string
      apiKey?: string
      apiKeys?: {
        atlasApiKey?: string
        atlasApiUrl?: string
        volcAccessKey?: string
        volcSecretKey?: string
        volcApiUrl?: string
      }
    }
  }>(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user
      const { name, apiKey, apiKeys } = request.body

      try {
        const updateData: any = {}
        if (name) updateData.name = name
        if (apiKey !== undefined) updateData.apiKey = apiKey || null
        if (apiKeys) {
          if (apiKeys.atlasApiKey !== undefined) updateData.atlasApiKey = apiKeys.atlasApiKey || null
          if (apiKeys.atlasApiUrl !== undefined) updateData.atlasApiUrl = apiKeys.atlasApiUrl || null
          if (apiKeys.volcAccessKey !== undefined) updateData.volcAccessKey = apiKeys.volcAccessKey || null
          if (apiKeys.volcSecretKey !== undefined) updateData.volcSecretKey = apiKeys.volcSecretKey || null
          if (apiKeys.volcApiUrl !== undefined) updateData.volcApiUrl = apiKeys.volcApiUrl || null
        }

        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          select: {
            id: true,
            email: true,
            name: true,
            apiKey: true
          }
        })

        return {
          success: true,
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            hasApiKey: !!updatedUser.apiKey
          }
        }
      } catch (error) {
        console.error('Failed to update user settings:', error)
        return reply.status(500).send({ error: '更新设置失败' })
      }
    }
  )

  // Verify API key (test connection)
  fastify.post<{ Body: { apiKey: string } }>(
    '/verify-api-key',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { apiKey } = request.body

      if (!apiKey) {
        return reply.status(400).send({ error: 'API Key 不能为空' })
      }

      try {
        const originalKey = process.env.DEEPSEEK_API_KEY
        process.env.DEEPSEEK_API_KEY = apiKey
        const balance = await getDeepSeekBalance()
        process.env.DEEPSEEK_API_KEY = originalKey

        return {
          valid: true,
          balance
        }
      } catch (error: any) {
        process.env.DEEPSEEK_API_KEY = ''
        return reply.status(400).send({
          valid: false,
          error: error.message || 'API Key 验证失败'
        })
      }
    }
  )
}
