/**
 * 上下文加载服务
 * 加载剧本记忆、项目设置、前情摘要等，构建完整的写作上下文
 */

import { prisma } from '../../lib/prisma.js'
import type { WritingContext, ScriptMemoryItem, ProjectMemoryItem } from './types.js'

export class ContextLoader {
  /**
   * 加载写作上下文
   */
  async loadContext(
    scriptId: string,
    options?: {
      includeProjectMemories?: boolean
      targetEpisode?: number
    }
  ): Promise<WritingContext> {
    // 1. 查询 Script 获取基本信息
    const script = await prisma.script.findUnique({
      where: { id: scriptId },
      select: {
        id: true,
        title: true,
        content: true,
        targetEpisode: true,
        projectId: true
      }
    })

    if (!script) {
      throw new Error(`Script not found: ${scriptId}`)
    }

    // 2. 查询 ScriptMemoryItem
    const scriptMemories = await prisma.scriptMemoryItem.findMany({
      where: {
        scriptId,
        isActive: true
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }]
    })

    const context: WritingContext = {
      scriptMemories: scriptMemories as ScriptMemoryItem[],
      currentScript: {
        id: script.id,
        title: script.title,
        content: script.content
      }
    }

    // 3. 如果有关联 project，加载项目记忆和设置
    if (options?.includeProjectMemories && script.projectId) {
      const projectMemories = await prisma.memoryItem.findMany({
        where: {
          projectId: script.projectId,
          isActive: true
        },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }]
      })

      context.projectMemories = projectMemories as ProjectMemoryItem[]

      // 加载项目设置
      const project = await prisma.project.findUnique({
        where: { id: script.projectId },
        select: {
          name: true,
          synopsis: true,
          visualStyle: true,
          characters: {
            select: {
              name: true,
              description: true
            }
          },
          locations: {
            select: {
              name: true,
              description: true
            }
          }
        }
      })

      if (project) {
        context.projectSettings = {
          title: project.name,
          synopsis: project.synopsis || '',
          style: project.visualStyle?.join(', ') || '',
          characters: project.characters.map((c) => ({
            name: c.name,
            description: c.description || ''
          })),
          locations: project.locations.map((l) => ({
            name: l.name,
            description: l.description || ''
          }))
        }
      }
    }

    // 4. 如果有 targetEpisode，加载前情（previous episodes）
    const targetEp = options?.targetEpisode ?? script.targetEpisode
    if (targetEp && script.projectId) {
      const previousEpisodes = await prisma.episode.findMany({
        where: {
          projectId: script.projectId,
          episodeNum: { lt: targetEp }
        },
        select: {
          episodeNum: true,
          synopsis: true
        },
        orderBy: { episodeNum: 'asc' }
      })

      context.previousEpisodes = previousEpisodes
        .filter((ep) => ep.synopsis)
        .map((ep) => ({
          episodeNum: ep.episodeNum,
          synopsis: ep.synopsis!
        }))
    }

    return context
  }

  /**
   * 获取剧本记忆（简化版，用于展示）
   */
  async getScriptMemories(scriptId: string): Promise<ScriptMemoryItem[]> {
    const memories = await prisma.scriptMemoryItem.findMany({
      where: {
        scriptId,
        isActive: true
      },
      orderBy: [{ type: 'asc' }, { importance: 'desc' }]
    })

    return memories as ScriptMemoryItem[]
  }

  /**
   * 保存剧本记忆
   */
  async saveScriptMemory(data: {
    scriptId: string
    type: string
    title: string
    content: string
    category?: string
    metadata?: Record<string, unknown>
    tags?: string[]
    importance?: number
  }): Promise<ScriptMemoryItem> {
    const memory = await prisma.scriptMemoryItem.create({
      data: {
        scriptId: data.scriptId,
        type: data.type as any, // MemoryType enum
        title: data.title,
        content: data.content,
        category: data.category,
        metadata: data.metadata as any,
        tags: data.tags || [],
        importance: data.importance ?? 3
      }
    })

    return memory as ScriptMemoryItem
  }

  /**
   * 批量保存剧本记忆
   */
  async saveScriptMemories(
    scriptId: string,
    memories: Array<{
      type: string
      title: string
      content: string
      category?: string
      metadata?: Record<string, unknown>
      tags?: string[]
      importance?: number
    }>
  ): Promise<ScriptMemoryItem[]> {
    const created = await Promise.all(
      memories.map((memory) => this.saveScriptMemory({ scriptId, ...memory }))
    )

    return created
  }
}

export const contextLoader = new ContextLoader()
