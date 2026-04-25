/** Chat business logic — orchestrates repository, streaming, and cost tracking */

import type { FastifyReply } from 'fastify'
import type { Prisma as PrismaTypes } from '@prisma/client'
import { chatRepository } from '../../repositories/chat-repository.js'
import { buildSystemPrompt } from './chat-prompts.js'
import { buildChatContext } from './chat-context-builder.js'
import { streamChatResponse } from './chat-stream-service.js'
import { recordModelApiCall } from '../ai/api-logger.js'
import { getModelInfo } from '../ai/llm/llm-model-catalog.js'
import { logInfo, logError } from '../../lib/error-logger.js'
import { CHAT_STREAM_HEARTBEAT_MS, QUICK_COMMAND_MAP } from './chat.constants.js'

// === Conversation CRUD ===

export async function createConversation(
  userId: string,
  params: { scriptId?: string; title?: string } = {}
) {
  return chatRepository.createConversation({
    userId,
    scriptId: params.scriptId || null,
    title: params.title || '新对话'
  })
}

export async function listConversations(
  userId: string,
  params: { scriptId?: string; limit?: number; offset?: number } = {}
) {
  const items = await chatRepository.findConversationsByUser(userId, params)

  return {
    items: items.map((c) => ({
      id: c.id,
      scriptId: c.scriptId,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString()
    })),
    total: items.length
  }
}

export async function getConversationWithMessages(
  userId: string,
  conversationId: string,
  params: { limit?: number; before?: Date } = {}
) {
  const conversation = await chatRepository.findConversationById(conversationId)
  if (!conversation) return null
  if (conversation.userId !== userId) return null

  const messages = await chatRepository.findMessagesByConversation(conversationId, params)

  return {
    conversation: {
      id: conversation.id,
      scriptId: conversation.scriptId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString()
    },
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      status: m.status,
      metadata: m.metadata as Record<string, unknown> | null,
      createdAt: m.createdAt.toISOString()
    }))
  }
}

export async function deleteConversation(userId: string, conversationId: string) {
  const conversation = await chatRepository.findConversationById(conversationId)
  if (!conversation) return false
  if (conversation.userId !== userId) return false

  await chatRepository.deleteConversation(conversationId)
  return true
}

// === Send Message ===

export interface SendMessageResult {
  userMessageId: string
  assistantMessageId: string
}

export async function sendMessage(
  userId: string,
  params: {
    conversationId: string
    content: string
    scriptContent?: string
    scriptTitle?: string
    quickCommand?: string
  }
): Promise<SendMessageResult | null> {
  // Validate ownership
  const conversation = await chatRepository.findConversationById(params.conversationId)
  if (!conversation || conversation.userId !== userId) return null

  // Auto-update title from first user message
  if (conversation.title === '新对话') {
    // Generate title from content or quick command
    let titleText = params.content
    if (params.quickCommand) {
      const command = QUICK_COMMAND_MAP[params.quickCommand]
      titleText = command ? `[${command.label}]` : params.quickCommand
    }
    if (titleText) {
      const title = titleText.slice(0, 30) + (titleText.length > 30 ? '...' : '')
      await chatRepository.updateConversation(params.conversationId, { title })
    }
  }

  // Build user message content
  let userContent = params.content
  if (params.quickCommand) {
    const command = QUICK_COMMAND_MAP[params.quickCommand]
    if (command) {
      userContent = `[快捷: ${command.label}] ${command.instruction}`
    }
  }

  // Save user message
  const userMessage = await chatRepository.createMessage({
    conversationId: params.conversationId,
    role: 'user',
    content: userContent,
    status: 'completed'
  })

  // Create assistant placeholder
  const assistantMessage = await chatRepository.createMessage({
    conversationId: params.conversationId,
    role: 'assistant',
    content: '',
    status: 'streaming'
  })

  return {
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id
  }
}

// === Stream Handler ===

export async function handleStream(
  userId: string,
  params: {
    conversationId: string
    assistantMessageId: string
    scriptContent?: string
    scriptTitle?: string
    model?: string
  },
  reply: FastifyReply
) {
  const { conversationId, assistantMessageId, scriptContent, scriptTitle, model } = params

  // Validate ownership
  const conversation = await chatRepository.findConversationById(conversationId)
  if (!conversation || conversation.userId !== userId) {
    reply.status(403).send({ error: '无权访问' })
    return
  }

  // Load messages for context
  const messages = await chatRepository.findMessagesByConversation(conversationId, {
    limit: 40 // CHAT_MAX_HISTORY_MESSAGES
  })

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    scriptContent,
    scriptTitle,
    quickCommand: undefined // quick command is embedded in the user message
  })

  // Build context
  const contextMessages = buildChatContext({
    systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  })

  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  // Heartbeat
  const heartbeat = setInterval(() => {
    try {
      reply.raw.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
    }
  }, CHAT_STREAM_HEARTBEAT_MS)

  // Cleanup on close
  reply.raw.on('close', () => {
    clearInterval(heartbeat)
  })

  // Send connected event
  reply.raw.write(
    `event: connected\ndata: ${JSON.stringify({ messageId: assistantMessageId })}\n\n`
  )

  let fullContent = ''
  let finalError: string | null = null

  try {
    const stream = streamChatResponse({
      messages: contextMessages as Array<{ role: string; content: string }>,
      model
    })

    for await (const event of stream) {
      if (event.type === 'token') {
        fullContent += event.content
        reply.raw.write(`event: token\ndata: ${JSON.stringify({ content: event.content })}\n\n`)
      } else if (event.type === 'done') {
        fullContent = event.fullContent

        // Parse suggestedEdit from fullContent
        const suggestedEdit = event.suggestedEdit
        const metadata: PrismaTypes.InputJsonValue = suggestedEdit ? { suggestedEdit } : {}

        // Update assistant message in DB
        await chatRepository.updateMessage(assistantMessageId, {
          content: fullContent,
          status: 'completed',
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
          costCNY: event.usage.costCNY,
          metadata
        })

        // Log model API call
        await recordModelApiCall({
          userId,
          model: model || 'deepseek-chat',
          provider: getModelInfo(model ?? '')?.provider || 'deepseek',
          prompt: fullContent.slice(0, 500),
          requestParams: { inputTokens: event.usage.inputTokens },
          status: 'completed',
          cost: event.usage.costCNY
        }).catch(() => {})

        const doneData: Record<string, unknown> = {
          fullContent,
          usage: event.usage
        }
        if (suggestedEdit) {
          doneData.suggestedEdit = suggestedEdit
        }

        reply.raw.write(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`)
      } else if (event.type === 'error') {
        finalError = event.message
        logError('Chat stream error', new Error(event.message))

        await chatRepository
          .updateMessage(assistantMessageId, {
            status: 'failed',
            content: fullContent || `Error: ${event.message}`
          })
          .catch(() => {})

        reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: event.message })}\n\n`)
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    finalError = message
    logError('Chat stream unexpected error', error)

    await chatRepository
      .updateMessage(assistantMessageId, {
        status: 'failed',
        content: fullContent || `Error: ${message}`
      })
      .catch(() => {})

    reply.raw.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
  }

  // Close connection
  clearInterval(heartbeat)
  reply.raw.end()

  logInfo('Chat stream completed', `conversationId=${conversationId}`, {
    assistantMessageId,
    error: finalError
  })
}
