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
          deepseekApiUrl: true,
          atlasApiKey: true,
          atlasApiUrl: true,
          arkApiKey: true,
          arkApiUrl: true,
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
          deepseekApiUrl: dbUser.deepseekApiUrl,
          atlasApiKey: dbUser.atlasApiKey,
          atlasApiUrl: dbUser.atlasApiUrl,
          arkApiKey: dbUser.arkApiKey,
          arkApiUrl: dbUser.arkApiUrl
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
        deepseekApiUrl?: string
        atlasApiKey?: string
        atlasApiUrl?: string
        arkApiKey?: string
        arkApiUrl?: string
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
          if (apiKeys.deepseekApiUrl !== undefined) updateData.deepseekApiUrl = apiKeys.deepseekApiUrl || null
          if (apiKeys.atlasApiKey !== undefined) updateData.atlasApiKey = apiKeys.atlasApiKey || null
          if (apiKeys.atlasApiUrl !== undefined) updateData.atlasApiUrl = apiKeys.atlasApiUrl || null
          if (apiKeys.arkApiKey !== undefined) updateData.arkApiKey = apiKeys.arkApiKey || null
          if (apiKeys.arkApiUrl !== undefined) updateData.arkApiUrl = apiKeys.arkApiUrl || null
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
