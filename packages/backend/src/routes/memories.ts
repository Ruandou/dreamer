/**
 * Memory API Routes
 *
 * Provides endpoints for querying, managing, and searching plot memories.
 * Memories include characters, locations, events, foreshadowings, relationships, etc.
 */

import { FastifyInstance } from 'fastify'
import { verifyProjectOwnership, getRequestUserId } from '../plugins/auth.js'
import { permissionDeniedBody } from '../lib/http-errors.js'
import { getMemoryService } from '../services/memory/index.js'
import { logError } from '../lib/error-logger.js'
import type { MemoryType } from '../repositories/memory-repository.js'
import type { ScriptContent } from '@dreamer/shared'

export async function memoryRoutes(fastify: FastifyInstance) {
  const memoryService = getMemoryService()

  // List memories for a project (with optional filters)
  fastify.get<{
    Params: { projectId: string }
    Querystring: {
      type?: MemoryType
      isActive?: string
      episodeId?: string
      tags?: string
      minImportance?: string
      category?: string
      limit?: string
      offset?: string
    }
  }>('/:projectId/memories', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUserId(request)
    const { projectId } = request.params
    const { type, isActive, episodeId, tags, minImportance, category, limit, offset } =
      request.query

    if (!(await verifyProjectOwnership(userId, projectId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 50
    const parsedOffset = offset ? parseInt(offset, 10) : 0

    const filters: Record<string, unknown> = {}
    if (type) filters.type = type
    if (isActive !== undefined) filters.isActive = isActive === 'true'
    if (episodeId) filters.episodeId = episodeId
    if (tags) filters.tags = tags.split(',').map((t) => t.trim())
    if (minImportance) {
      const val = parseInt(minImportance, 10)
      if (val >= 1 && val <= 5) filters.minImportance = val
    }
    if (category) filters.category = category
    filters.limit = Math.min(parsedLimit, 500)
    filters.offset = Math.max(0, parsedOffset)

    const memories = await memoryService.queryMemories(
      projectId,
      filters as Parameters<typeof memoryService.queryMemories>[1]
    )

    return {
      success: true,
      count: memories.length,
      data: memories
    }
  })

  // Get single memory by ID
  fastify.get<{
    Params: { projectId: string; memoryId: string }
  }>(
    '/:projectId/memories/:memoryId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId, memoryId } = request.params

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const memory = await memoryService
        .queryMemories(projectId, {})
        .then((memories) => memories.find((m) => m.id === memoryId))

      if (!memory) {
        return reply.status(404).send({
          success: false,
          error: 'Memory not found'
        })
      }

      return {
        success: true,
        data: memory
      }
    }
  )

  // Create memory manually
  fastify.post<{
    Params: { projectId: string }
    Body: {
      type: MemoryType
      category?: string
      title: string
      content: string
      tags?: string[]
      importance?: number
      episodeId?: string
      metadata?: Record<string, unknown>
    }
  }>('/:projectId/memories', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getRequestUserId(request)
    const { projectId } = request.params
    const { type, category, title, content, tags, importance, episodeId, metadata } = request.body

    if (!(await verifyProjectOwnership(userId, projectId))) {
      return reply.status(403).send(permissionDeniedBody)
    }

    // Validate required fields
    if (!type || !title || !content) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields: type, title, content'
      })
    }

    // Validate importance range
    if (importance !== undefined && (importance < 1 || importance > 5)) {
      return reply.status(400).send({
        success: false,
        error: 'Importance must be between 1 and 5'
      })
    }

    const memory = await memoryService.queryMemories(projectId, {}).then(async () => {
      // Use repository directly for creation
      const { MemoryRepository } = await import('../repositories/memory-repository.js')
      const repo = new MemoryRepository()
      return repo.create({
        projectId,
        type,
        category,
        title,
        content,
        tags: tags || [],
        importance: importance || 3,
        episodeId,
        metadata
      })
    })

    return reply.status(201).send({
      success: true,
      data: memory
    })
  })

  // Update memory
  fastify.put<{
    Params: { projectId: string; memoryId: string }
    Body: {
      title?: string
      content?: string
      tags?: string[]
      importance?: number
      isActive?: boolean
      verified?: boolean
      category?: string
    }
  }>(
    '/:projectId/memories/:memoryId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId, memoryId } = request.params
      const { title, content, tags, importance, isActive, verified, category } = request.body

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      // Validate importance range
      if (importance !== undefined && (importance < 1 || importance > 5)) {
        return reply.status(400).send({
          success: false,
          error: 'Importance must be between 1 and 5'
        })
      }

      try {
        const updated = await memoryService.updateMemory(memoryId, {
          title,
          content,
          tags,
          importance,
          isActive,
          verified,
          category
        })

        return {
          success: true,
          data: updated
        }
      } catch (error: unknown) {
        if (error instanceof Error && (error as { code?: string }).code === 'P2025') {
          return reply.status(404).send({
            success: false,
            error: 'Memory not found'
          })
        }
        throw error
      }
    }
  )

  // Delete memory
  fastify.delete<{
    Params: { projectId: string; memoryId: string }
  }>(
    '/:projectId/memories/:memoryId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId, memoryId } = request.params

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      try {
        await memoryService.deleteMemory(memoryId)

        return {
          success: true,
          message: 'Memory deleted successfully'
        }
      } catch (error: unknown) {
        if (error instanceof Error && (error as { code?: string }).code === 'P2025') {
          return reply.status(404).send({
            success: false,
            error: 'Memory not found'
          })
        }
        throw error
      }
    }
  )

  // Search memories by text query
  fastify.post<{
    Params: { projectId: string }
    Body: {
      query: string
      limit?: number
    }
  }>(
    '/:projectId/memories/search',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId } = request.params
      const { query, limit } = request.body

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      if (!query || query.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Query parameter is required'
        })
      }

      const cappedLimit = Math.min(Math.max(1, limit || 10), 100)
      const memories = await memoryService.searchMemories(projectId, query, cappedLimit)

      return {
        success: true,
        count: memories.length,
        data: memories
      }
    }
  )

  // Get writing context for episode
  fastify.get<{
    Params: { projectId: string }
    Querystring: { episodeNum: string }
  }>(
    '/:projectId/memories/context',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId } = request.params
      const { episodeNum } = request.query

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      if (!episodeNum) {
        return reply.status(400).send({
          success: false,
          error: 'episodeNum query parameter is required'
        })
      }

      const context = await memoryService.getEpisodeWritingContext(
        projectId,
        parseInt(episodeNum, 10)
      )

      return {
        success: true,
        data: context
      }
    }
  )

  // Trigger manual memory extraction from episode
  fastify.post<{
    Params: { projectId: string }
    Body: {
      episodeId: string
      episodeNum: number
    }
  }>(
    '/:projectId/memories/extract',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId } = request.params
      const { episodeId, episodeNum } = request.body

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      if (!episodeId || !episodeNum) {
        return reply.status(400).send({
          success: false,
          error: 'episodeId and episodeNum are required'
        })
      }

      // Fetch episode script
      const { prisma } = await import('../lib/prisma.js')
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId }
      })

      if (!episode || !episode.script) {
        return reply.status(404).send({
          success: false,
          error: 'Episode not found or has no script'
        })
      }

      try {
        const result = await memoryService.extractAndSaveMemories(
          projectId,
          episodeNum,
          episodeId,
          episode.script as unknown as ScriptContent,
          { userId, projectId, op: 'manual_memory_extraction' }
        )

        return {
          success: true,
          data: result,
          message: `Extracted ${result.extracted} memories, saved ${result.saved}`
        }
      } catch (error: unknown) {
        logError('memory-route', error, { op: 'manual_memory_extraction' })
        return reply.status(500).send({
          success: false,
          error: 'Memory extraction failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  )

  // Get memory statistics
  fastify.get<{
    Params: { projectId: string }
  }>(
    '/:projectId/memories/stats',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = getRequestUserId(request)
      const { projectId } = request.params

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send(permissionDeniedBody)
      }

      const { MemoryRepository } = await import('../repositories/memory-repository.js')
      const repo = new MemoryRepository()

      const memories = await repo.findByProject(projectId)

      const stats = {
        total: memories.length,
        byType: {} as Record<string, number>,
        byImportance: {} as Record<string, number>,
        active: memories.filter((m) => m.isActive).length,
        verified: memories.filter((m) => m.verified).length,
        averageImportance:
          memories.length > 0
            ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
            : 0
      }

      // Count by type
      memories.forEach((m) => {
        stats.byType[m.type] = (stats.byType[m.type] || 0) + 1
      })

      // Count by importance
      memories.forEach((m) => {
        const key = m.importance.toString()
        stats.byImportance[key] = (stats.byImportance[key] || 0) + 1
      })

      return {
        success: true,
        data: stats
      }
    }
  )
}
