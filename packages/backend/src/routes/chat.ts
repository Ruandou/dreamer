import { FastifyInstance } from 'fastify'
import { getRequestUserId } from '../plugins/auth.js'
import { logInfo, logError } from '../lib/error-logger.js'
import {
  createConversation,
  listConversations,
  getConversationWithMessages,
  deleteConversation,
  sendMessage,
  handleStream
} from '../services/chat/index.js'

interface CreateConversationBody {
  scriptId?: string
  title?: string
}

interface SendMessageBody {
  content: string
  scriptContent?: string
  scriptTitle?: string
  quickCommand?: string
}

export async function chatRoutes(fastify: FastifyInstance) {
  // Create conversation
  fastify.post<{ Body: CreateConversationBody }>(
    '/conversations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { scriptId, title } = request.body

        const conversation = await createConversation(userId, { scriptId, title })

        logInfo('创建对话', `userId=${userId}`, { conversationId: conversation.id })
        return reply.status(201).send(conversation)
      } catch (error) {
        logError('创建对话失败', error)
        return reply.status(500).send({ error: '创建对话失败' })
      }
    }
  )

  // List conversations
  fastify.get('/conversations', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = getRequestUserId(request)
      const scriptId = (request.query as Record<string, string>)?.scriptId
      const limit = parseInt((request.query as Record<string, string>)?.limit || '50', 10)
      const offset = parseInt((request.query as Record<string, string>)?.offset || '0', 10)

      const result = await listConversations(userId, { scriptId, limit, offset })
      return result
    } catch (error) {
      logError('获取对话列表失败', error)
      return reply.status(500).send({ error: '获取对话列表失败' })
    }
  })

  // Get conversation with messages
  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params
        const limit = parseInt((request.query as Record<string, string>)?.limit || '50', 10)

        const result = await getConversationWithMessages(userId, id, { limit })
        if (!result) {
          return reply.status(404).send({ error: '对话不存在或无权访问' })
        }

        return result
      } catch (error) {
        logError('获取对话详情失败', error)
        return reply.status(500).send({ error: '获取对话详情失败' })
      }
    }
  )

  // Delete conversation
  fastify.delete<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = getRequestUserId(request)
        const { id } = request.params

        const deleted = await deleteConversation(userId, id)
        if (!deleted) {
          return reply.status(404).send({ error: '对话不存在或无权访问' })
        }

        logInfo('删除对话', `userId=${userId}`, { conversationId: id })
        return reply.status(204).send()
      } catch (error) {
        logError('删除对话失败', error)
        return reply.status(500).send({ error: '删除对话失败' })
      }
    }
  )

  // Send message (SSE streaming response)
  fastify.post<{ Params: { id: string }; Body: SendMessageBody }>(
    '/conversations/:id/messages',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { content, scriptContent, scriptTitle, quickCommand } = request.body

      // Allow empty content if quickCommand is provided
      if (!content?.trim() && !quickCommand) {
        return reply.status(400).send({ error: '消息内容不能为空' })
      }

      try {
        const userId = getRequestUserId(request)

        const result = await sendMessage(userId, {
          conversationId: id,
          content,
          scriptContent,
          scriptTitle,
          quickCommand
        })

        if (!result) {
          return reply.status(404).send({ error: '对话不存在或无权访问' })
        }

        // Handle the streaming response
        await handleStream(
          userId,
          {
            conversationId: id,
            assistantMessageId: result.assistantMessageId,
            scriptContent,
            scriptTitle
          },
          reply
        )

        // Note: handleStream manages the raw response and ends it
        // Return the promise to let Fastify know the request is handled
        return reply
      } catch (error) {
        logError('发送消息失败', error)
        return reply.status(500).send({ error: '发送消息失败' })
      }
    }
  )
}
