import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { getRequestUser } from '../plugins/auth.js'
import { prisma } from '../lib/prisma.js'
import { ALL_LLM_MODELS } from '../services/ai/llm/llm-model-catalog.js'
import { listLLMProviders } from '../services/ai/llm/llm-registry.js'
import { listImageProviders } from '../services/ai/image/image-registry.js'
import { listVideoProviders } from '../services/ai/video/video-registry.js'
import { listSearchProviders } from '../services/ai/search/search-registry.js'

export async function modelRoutes(fastify: FastifyInstance) {
  // 获取所有可用模型和 Provider 信息
  fastify.get('/', { preHandler: [fastify.authenticate] }, async () => {
    return {
      llm: {
        providers: listLLMProviders(),
        models: ALL_LLM_MODELS
      },
      image: {
        providers: listImageProviders(),
        models: [
          { id: 'doubao-seedream-5-0-lite', name: 'Seedream 5.0 Lite', provider: 'ark' },
          { id: 'kling-image-o1', name: 'Kling Omni-Image', provider: 'kling' },
          { id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai' }
        ]
      },
      video: {
        providers: listVideoProviders(),
        models: [
          { id: 'doubao-seedance-2-0-fast', name: 'Seedance 2.0 Fast', provider: 'ark' },
          { id: 'kling-video-o1', name: 'Kling Omni-Video', provider: 'kling' }
        ]
      },
      search: {
        providers: listSearchProviders(),
        models: [
          { id: 'web', name: '网页搜索', provider: 'volc' },
          { id: 'web_summary', name: '网页搜索+总结', provider: 'volc' },
          { id: 'image', name: '图片搜索', provider: 'volc' }
        ]
      }
    }
  })

  // 获取当前用户的模型偏好
  fastify.get('/preferences', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = getRequestUser(request)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { modelPreferences: true }
    })
    return {
      preferences: dbUser?.modelPreferences || {}
    }
  })

  // 更新当前用户的模型偏好
  fastify.put<{
    Body: Record<string, unknown>
  }>('/preferences', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = getRequestUser(request)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { modelPreferences: request.body as unknown as Prisma.InputJsonValue },
      select: { modelPreferences: true }
    })

    return { preferences: updated.modelPreferences }
  })
}
