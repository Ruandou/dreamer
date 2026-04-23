/**
 * AI 编剧 Agent 路由
 * 提供自然语言驱动的剧本生成与修改功能
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { getRequestUserId } from '../plugins/auth.js'
import { createWritingOrchestrator } from '../services/agents/writing-orchestrator.js'
import { getMemoryService } from '../services/memory/memory-service.js'
import type { AgentResponse, ConfirmRequest } from '../services/agents/types.js'

// 内存中存储协调器（后续可持久化到数据库）
const orchestrators = new Map<string, ReturnType<typeof createWritingOrchestrator>>()

/**
 * POST /api/scripts/:id/agent
 * Agent 主入口：接收用户指令，解析意图
 */
export async function scriptAgentRoutes(fastify: FastifyInstance) {
  // POST /api/scripts/:id/agent
  fastify.post('/:id/agent', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = getRequestUserId(request)
      const { id } = request.params as { id: string }
      const body = request.body as {
        command: string
        context?: {
          selectedText?: string
          targetEpisode?: number
        }
      }
      const { command } = body

      // 验证剧本存在且属于当前用户
      const script = await prisma.script.findFirst({
        where: { id, userId }
      })

      if (!script) {
        return reply.status(404).send({ error: '剧本不存在或无权访问' })
      }

      // 创建或获取协调器
      let orchestrator = orchestrators.get(id)
      if (!orchestrator) {
        orchestrator = createWritingOrchestrator(id, userId)
        orchestrators.set(id, orchestrator)
      }

      // 解析意图
      const response = await orchestrator.parseIntent(command)

      return response
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Agent 处理失败',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  })

  // POST /api/scripts/:id/agent/confirm
  fastify.post(
    '/:id/agent/confirm',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params as { id: string }
        const body = request.body as ConfirmRequest
        const { action, revisionInstruction } = body

        // 验证剧本存在且属于当前用户
        const script = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!script) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        // 获取协调器
        const orchestrator = orchestrators.get(id)
        if (!orchestrator) {
          return reply.status(400).send({
            error: '会话已过期或不存在',
            hint: '请重新发送指令开始对话'
          })
        }

        const state = orchestrator.getState()

        // 根据当前步骤和动作处理
        let response: AgentResponse

        if (state.currentStep === 'intent_parsed') {
          if (action === 'confirm') {
            // 用户确认意图，生成大纲
            response = await orchestrator.generateOutline()
          } else {
            // 用户要求修改意图，重新解析
            if (!revisionInstruction) {
              return reply.status(400).send({ error: '请提供修改指令' })
            }
            response = await orchestrator.parseIntent(revisionInstruction)
          }
        } else if (state.currentStep === 'outline_generated') {
          if (action === 'confirm') {
            // 用户确认大纲，生成草稿（包含内部审核和修改）
            response = await orchestrator.generateDraftWithCritique()
          } else {
            // 用户要求修改大纲
            if (!revisionInstruction) {
              return reply.status(400).send({ error: '请提供修改指令' })
            }
            // 重新生成大纲（简化处理：直接重新生成）
            response = await orchestrator.generateOutline()
          }
        } else if (
          state.currentStep === 'draft_generated' ||
          state.currentStep === 'critiqued' ||
          state.currentStep === 'revised'
        ) {
          if (action === 'confirm') {
            // 用户接受草稿
            response = await orchestrator.acceptDraft()
          } else {
            // 用户要求修改草稿
            if (!revisionInstruction) {
              return reply.status(400).send({ error: '请提供修改指令' })
            }
            response = await orchestrator.reviseDraft(revisionInstruction)
          }
        } else {
          return reply.status(400).send({ error: '当前状态不支持此操作' })
        }

        return response
      } catch (error) {
        fastify.log.error(error)
        return reply.status(500).send({
          error: '确认处理失败',
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // GET /api/scripts/:id/memories
  fastify.get('/:id/memories', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = getRequestUserId(request)
      const { id } = request.params as { id: string }

      // 验证剧本存在且属于当前用户
      const script = await prisma.script.findFirst({
        where: { id, userId }
      })

      if (!script) {
        return reply.status(404).send({ error: '剧本不存在或无权访问' })
      }

      const memories = await prisma.scriptMemoryItem.findMany({
        where: {
          scriptId: id,
          isActive: true
        },
        orderBy: [{ type: 'asc' }, { importance: 'desc' }]
      })

      return { memories }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: '获取记忆失败',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  })

  // POST /api/scripts/:id/agent/memories/sync
  fastify.post(
    '/:id/agent/memories/sync',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params as { id: string }
        const body = request.body as { projectId: string }
        const { projectId } = body

        if (!projectId) {
          return reply.status(400).send({ error: '请提供 projectId' })
        }

        // 验证剧本存在且属于当前用户
        const script = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!script) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        // 同步记忆
        const memoryService = getMemoryService()
        const result = await memoryService.syncScriptMemoriesToProject(id, projectId)

        return result
      } catch (error) {
        fastify.log.error(error)
        return reply.status(500).send({
          error: '记忆同步失败',
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // DELETE /api/scripts/:id/agent/session (清除会话)
  fastify.delete('/:id/agent/session', { preHandler: [fastify.authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    orchestrators.delete(id)
    return { success: true }
  })

  // POST /api/scripts/:id/agent/stream (SSE 流式端点)
  fastify.post(
    '/:id/agent/stream',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'string',
            format: 'binary'
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params as { id: string }
        const body = request.body as { command: string }
        const { command } = body

        const script = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!script) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        // 创建协调器
        const orchestrator = createWritingOrchestrator(id, userId)
        orchestrators.set(id, orchestrator)

        const raw = reply.raw
        raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no'
        })

        // 立即 flush 头
        raw.flushHeaders()

        // 流式执行
        for await (const event of orchestrator.executeStream(command)) {
          const sseData = `event: agent-${event.type}\ndata: ${JSON.stringify(event)}\n\n`
          raw.write(sseData)

          // 如果需要用户操作，暂停并等待确认
          if (
            event.type === 'step_complete' &&
            'requiresUserAction' in event &&
            event.requiresUserAction
          ) {
            raw.write(`event: agent-pause\ndata: ${JSON.stringify(event)}\n\n`)
            break
          }
        }
      } catch (error) {
        request.log.error(error)
        reply.raw.write(
          `event: agent-error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`
        )
      } finally {
        reply.raw.end()
      }
    }
  )

  // POST /api/scripts/:id/agent/confirm/stream (SSE 流式确认端点)
  fastify.post(
    '/:id/agent/confirm/stream',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'string',
            format: 'binary'
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params as { id: string }
        const body = request.body as ConfirmRequest & { targetEpisode?: number }
        const { action, revisionInstruction, targetEpisode } = body

        const script = await prisma.script.findFirst({
          where: { id, userId }
        })

        if (!script) {
          return reply.status(404).send({ error: '剧本不存在或无权访问' })
        }

        const orchestrator = orchestrators.get(id)
        if (!orchestrator) {
          return reply.status(400).send({
            error: '会话已过期或不存在',
            hint: '请重新发送指令开始对话'
          })
        }

        const raw = reply.raw
        raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no'
        })

        raw.flushHeaders()

        if (action === 'confirm') {
          // 继续流式执行
          for await (const event of orchestrator.continueStream(targetEpisode)) {
            raw.write(`event: agent-${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
          }
        } else if (action === 'revise' && revisionInstruction) {
          // 用户要求修改，重新解析意图
          for await (const event of orchestrator.executeStream(revisionInstruction)) {
            raw.write(`event: agent-${event.type}\ndata: ${JSON.stringify(event)}\n\n`)

            if (
              event.type === 'step_complete' &&
              'requiresUserAction' in event &&
              event.requiresUserAction
            ) {
              raw.write(`event: agent-pause\ndata: ${JSON.stringify(event)}\n\n`)
              break
            }
          }
        }
      } catch (error) {
        request.log.error(error)
        reply.raw.write(
          `event: agent-error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : String(error) })}\n\n`
        )
      } finally {
        reply.raw.end()
      }
    }
  )
}
