import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export type MemoryType =
  | 'CHARACTER'
  | 'LOCATION'
  | 'EVENT'
  | 'PLOT_POINT'
  | 'FORESHADOWING'
  | 'RELATIONSHIP'
  | 'VISUAL_STYLE'

export interface CreateMemoryItemInput {
  projectId: string
  type: MemoryType
  category?: string
  title: string
  content: string
  metadata?: Record<string, unknown>
  episodeId?: string
  tags?: string[]
  importance?: number
  relatedIds?: string[]
}

export interface UpdateMemoryItemInput {
  title?: string
  content?: string
  metadata?: Record<string, unknown>
  tags?: string[]
  importance?: number
  isActive?: boolean
  verified?: boolean
  relatedIds?: string[]
  category?: string
}

export interface MemoryFilter {
  type?: MemoryType
  isActive?: boolean
  minImportance?: number
  episodeId?: string
  tags?: string[]
  category?: string
}

export interface SnapshotData {
  summary: string
  contextJson: Record<string, unknown>
}

export class MemoryRepository {
  async create(data: CreateMemoryItemInput) {
    return prisma.memoryItem.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        category: data.category,
        title: data.title,
        content: data.content,
        metadata: data.metadata as Prisma.InputJsonValue,
        episodeId: data.episodeId,
        tags: data.tags || [],
        importance: data.importance || 3,
        relatedIds: data.relatedIds || []
      }
    })
  }

  async findById(id: string) {
    return prisma.memoryItem.findUnique({
      where: { id }
    })
  }

  async update(id: string, data: UpdateMemoryItemInput) {
    return prisma.memoryItem.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        metadata: data.metadata as Prisma.InputJsonValue,
        tags: data.tags,
        importance: data.importance,
        isActive: data.isActive,
        verified: data.verified,
        relatedIds: data.relatedIds,
        category: data.category
      }
    })
  }

  async delete(id: string) {
    await prisma.memoryItem.delete({
      where: { id }
    })
  }

  async findByProject(projectId: string, filters?: MemoryFilter) {
    const where: Record<string, unknown> = { projectId }

    if (filters) {
      if (filters.type) where.type = filters.type
      if (filters.isActive !== undefined) where.isActive = filters.isActive
      if (filters.minImportance) where.importance = { gte: filters.minImportance }
      if (filters.episodeId) where.episodeId = filters.episodeId
      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags }
      }
      if (filters.category) where.category = filters.category
    }

    return prisma.memoryItem.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { createdAt: 'asc' }]
    })
  }

  async findByType(projectId: string, type: MemoryType) {
    return prisma.memoryItem.findMany({
      where: { projectId, type },
      orderBy: [{ importance: 'desc' }, { createdAt: 'asc' }]
    })
  }

  async findByEpisode(projectId: string, episodeId: string) {
    return prisma.memoryItem.findMany({
      where: { projectId, episodeId },
      orderBy: [{ importance: 'desc' }, { createdAt: 'asc' }]
    })
  }

  async findActive(projectId: string) {
    return prisma.memoryItem.findMany({
      where: { projectId, isActive: true },
      orderBy: [{ importance: 'desc' }, { createdAt: 'asc' }]
    })
  }

  async findSimilar(projectId: string, query: string, limit: number = 5) {
    // 简单实现：基于标签和标题的文本匹配
    // TODO: 后续使用向量检索
    const keywords = query.toLowerCase().split(/\s+/)

    const memories = await prisma.memoryItem.findMany({
      where: {
        projectId,
        isActive: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: keywords } }
        ]
      },
      orderBy: [{ importance: 'desc' }],
      take: limit
    })

    return memories
  }

  async createSnapshot(projectId: string, upToEpisode: number, data: SnapshotData) {
    return prisma.memorySnapshot.upsert({
      where: {
        projectId_upToEpisode: {
          projectId,
          upToEpisode
        }
      },
      update: {
        summary: data.summary,
        contextJson: data.contextJson as Prisma.InputJsonValue,
        snapshotAt: new Date()
      },
      create: {
        projectId,
        upToEpisode,
        summary: data.summary,
        contextJson: data.contextJson as Prisma.InputJsonValue
      }
    })
  }

  async getLatestSnapshot(projectId: string) {
    return prisma.memorySnapshot.findFirst({
      where: { projectId },
      orderBy: { upToEpisode: 'desc' }
    })
  }

  async getSnapshotByEpisode(projectId: string, upToEpisode: number) {
    return prisma.memorySnapshot.findUnique({
      where: {
        projectId_upToEpisode: {
          projectId,
          upToEpisode
        }
      }
    })
  }

  async countByType(projectId: string, type: MemoryType) {
    return prisma.memoryItem.count({
      where: { projectId, type }
    })
  }

  async bulkCreate(items: CreateMemoryItemInput[]) {
    if (items.length === 0) return []

    return prisma.memoryItem.createMany({
      data: items.map((item) => ({
        projectId: item.projectId,
        type: item.type,
        category: item.category,
        title: item.title,
        content: item.content,
        metadata: item.metadata as Prisma.InputJsonValue,
        episodeId: item.episodeId,
        tags: item.tags || [],
        importance: item.importance || 3,
        relatedIds: item.relatedIds || []
      })),
      skipDuplicates: true
    })
  }

  async markInactiveByEpisode(projectId: string, beforeEpisodeId: string) {
    return prisma.memoryItem.updateMany({
      where: {
        projectId,
        episodeId: beforeEpisodeId,
        isActive: true
      },
      data: { isActive: false }
    })
  }
}
