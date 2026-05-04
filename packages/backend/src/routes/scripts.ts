import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getRequestUserId } from '../plugins/auth.js'
import { logInfo, logError } from '../lib/error-logger.js'
import { callLLMWithRetry } from '../services/ai/llm/llm-call-wrapper.js'
import { createArkLLMProvider } from '../services/ai/llm/llm-factory.js'
import {
  ArkLLMAuthError,
  ArkLLMRateLimitError
} from '../services/ai/llm/providers/ark-llm-provider.js'

interface CreateScriptBody {
  title?: string
  content?: string
  tags?: string[]
}

interface UpdateScriptBody {
  title?: string
  content?: string
  status?: 'DRAFT' | 'READY' | 'ARCHIVED'
  tags?: string[]
}

interface ListScriptsQuery {
  tag?: string
  status?: 'DRAFT' | 'READY' | 'ARCHIVED'
}

interface AIReviseBody {
  content: string
  instruction: string
}

export async function scriptsRoutes(fastify: FastifyInstance) {
  // 获取用户所有剧本
  fastify.get<{ Querystring: ListScriptsQuery }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { tag, status } = request.query

        const where: {
          userId: string
          tags?: { hasSome: string[] }
          status?: 'DRAFT' | 'READY' | 'ARCHIVED'
        } = { userId }
        if (tag) {
          where.tags = { hasSome: [tag] }
        }
        if (status) {
          where.status = status
        }

        const scripts = await prisma.script.findMany({
          where,
          orderBy: { updatedAt: 'desc' }
        })
        return scripts
      } catch (error) {
        logError('获取剧本列表失败', { error })
        return reply.status(500).send({ error: '获取剧本列表失败' })
      }
    }
  )

  // 获取用户最新草稿（无则自动创建）
  fastify.get('/latest', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = getRequestUserId(request)

      // 查找最新的 DRAFT 状态剧本
      let script = await prisma.script.findFirst({
        where: { userId, status: 'DRAFT' },
        orderBy: { updatedAt: 'desc' }
      })

      // 如果没有，自动创建一个默认草稿
      if (!script) {
        script = await prisma.script.create({
          data: {
            userId,
            title: '未命名剧本',
            content: `Scene 1. 破旧屋内 - 夜

昏暗压抑，远处传来更鼓声。床上，宋应星虚弱地缓缓睁开眼，眼神迷茫。

他的视线缓缓下移，聚焦在自己枯瘦的手腕和破旧的衣衫上。

宋应星："这是……哪里？"

Scene 2. 破旧屋内 - 夜

木门吱呀一声被推开，母亲端着一个药碗走进来，面容憔悴。当她看到床上苏醒的儿子时，脸上先是惊讶，随即涌上激动的情绪，快步走到床边：

母亲："应星，你醒了？三天了，你昏迷了三天！娘以为你也要丢下娘了！"
`
          }
        })
        logInfo('Scripts', '自动创建默认草稿', { userId, scriptId: script.id })
      }

      return script
    } catch (error) {
      logError('Scripts', '获取最新草稿失败', {
        error: error instanceof Error ? error.message : String(error)
      })
      return reply.status(500).send({ error: '获取最新草稿失败' })
    }
  })

  // 创建新剧本
  fastify.post<{ Body: CreateScriptBody }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { title = '未命名剧本', content = '', tags } = request.body

        const script = await prisma.script.create({
          data: { userId, title, content, tags: tags ?? [] }
        })

        logInfo('Scripts', '创建新剧本', { userId, scriptId: script.id })
        return reply.status(201).send(script)
      } catch (error) {
        logError('Scripts', '创建剧本失败', {
          error: error instanceof Error ? error.message : String(error)
        })
        return reply.status(500).send({ error: '创建剧本失败' })
      }
    }
  )

  // 获取剧本详情
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params

        const script = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!script) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        return script
      } catch (error) {
        logError('获取剧本详情失败', { error })
        return reply.status(500).send({ error: '获取剧本详情失败' })
      }
    }
  )

  // 更新剧本
  fastify.put<{ Params: { id: string }; Body: UpdateScriptBody }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params
        const { title, content, status, tags } = request.body

        // 验证剧本存在且属于当前用户
        const existing = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!existing) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        const updated = await prisma.script.update({
          where: { id },
          data: {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            ...(status !== undefined && { status }),
            ...(tags !== undefined && { tags })
          }
        })

        logInfo('Scripts', '更新剧本', { userId, scriptId: id })
        return updated
      } catch (error) {
        logError('Scripts', '更新剧本失败', {
          error: error instanceof Error ? error.message : String(error)
        })
        return reply.status(500).send({ error: '更新剧本失败' })
      }
    }
  )

  // 删除剧本
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params

        const existing = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!existing) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        await prisma.script.delete({ where: { id } })
        logInfo('Scripts', '删除剧本', { userId, scriptId: id })
        return reply.status(204).send()
      } catch (error) {
        logError('Scripts', '删除剧本失败', {
          error: error instanceof Error ? error.message : String(error)
        })
        return reply.status(500).send({ error: '删除剧本失败' })
      }
    }
  )

  // AI 修改代理
  fastify.post<{ Body: AIReviseBody }>(
    '/:id/ai-revise',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const startTime = Date.now()
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params as { id: string }
        const { content, instruction } = request.body

        // 验证剧本存在且属于当前用户
        const existing = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!existing) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        // 调用 DeepSeek API
        const { arkApiKey, arkApiUrl } = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { arkApiKey: true, arkApiUrl: true }
        })

        if (!arkApiKey) {
          return reply.status(400).send({ error: '请先在设置中配置方舟 API Key' })
        }

        const provider = createArkLLMProvider(arkApiKey, arkApiUrl || undefined)

        const result = await callLLMWithRetry(
          {
            provider,
            messages: [
              {
                role: 'system',
                content:
                  '你是一个专业的剧本编辑助手。根据用户的指令修改剧本内容，保持剧本格式和风格一致。只返回修改后的完整剧本内容，不要添加任何解释或说明。'
              },
              {
                role: 'user',
                content: `请根据以下指令修改剧本内容：\n\n指令：${instruction}\n\n当前剧本内容：\n${content}`
              }
            ],
            temperature: 0.7,
            maxTokens: 4000,
            model: 'deepseek-v3',
            modelLog: { userId, op: 'script_ai_revise' }
          },
          (content) => content
        )

        const duration = Date.now() - startTime
        logInfo('Scripts', 'AI 修改成功', { userId, scriptId: id, duration })
        return { revisedContent: result.content }
      } catch (error) {
        if (error instanceof ArkLLMAuthError) {
          return reply.status(401).send({ error: 'AI 修改失败：API 认证错误' })
        }
        if (error instanceof ArkLLMRateLimitError) {
          return reply.status(429).send({ error: 'AI 修改失败：请求过于频繁' })
        }
        logError('Scripts', 'AI 修改异常', {
          error: error instanceof Error ? error.message : String(error)
        })
        return reply.status(500).send({ error: 'AI 修改异常' })
      }
    }
  )
}
