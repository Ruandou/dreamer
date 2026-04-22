import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // === Conversations ===

  createConversation(data: Prisma.ChatConversationUncheckedCreateInput) {
    return this.prisma.chatConversation.create({ data })
  }

  findConversationById(id: string) {
    return this.prisma.chatConversation.findUnique({
      where: { id },
      include: { _count: { select: { messages: true } } }
    })
  }

  findConversationsByUser(
    userId: string,
    options?: { scriptId?: string; limit?: number; offset?: number }
  ) {
    const { scriptId, limit = 50, offset = 0 } = options ?? {}
    return this.prisma.chatConversation.findMany({
      where: {
        userId,
        ...(scriptId ? { scriptId } : {})
      },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit
    })
  }

  updateConversation(id: string, data: Prisma.ChatConversationUpdateInput) {
    return this.prisma.chatConversation.update({
      where: { id },
      data
    })
  }

  deleteConversation(id: string) {
    return this.prisma.chatConversation.delete({ where: { id } })
  }

  // === Messages ===

  createMessage(data: Prisma.ChatMessageUncheckedCreateInput) {
    return this.prisma.chatMessage.create({ data })
  }

  updateMessage(id: string, data: Prisma.ChatMessageUpdateInput) {
    return this.prisma.chatMessage.update({
      where: { id },
      data
    })
  }

  findMessagesByConversation(conversationId: string, options?: { limit?: number; before?: Date }) {
    const { limit = 50, before } = options ?? {}
    return this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: before } } : {})
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    })
  }

  findMessageById(id: string) {
    return this.prisma.chatMessage.findUnique({ where: { id } })
  }
}

export const chatRepository = new ChatRepository(prisma)
