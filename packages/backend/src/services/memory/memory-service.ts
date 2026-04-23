import {
  MemoryRepository,
  type CreateMemoryItemInput
} from '../../repositories/memory-repository.js'
import { extractMemoriesWithLLM, formatExistingMemories } from './extractor.js'
import { buildEpisodeWritingContext, buildStoryboardContext } from './context-builder.js'
import type { ScriptContent } from '@dreamer/shared/types'
import type { ModelCallLogContext } from '../ai/model-call-log.js'
import { prisma } from '../../lib/prisma.js'

export class MemoryService {
  constructor(private repo: MemoryRepository) {}

  /**
   * 从剧本提取并保存记忆
   */
  async extractAndSaveMemories(
    projectId: string,
    episodeNum: number,
    episodeId: string,
    script: ScriptContent,
    modelLog?: ModelCallLogContext
  ) {
    // 获取已有记忆
    const existingMemories = await this.repo.findByProject(projectId)
    const existingText = formatExistingMemories(
      existingMemories.map((m) => ({
        type: m.type,
        title: m.title,
        content: m.content
      }))
    )

    // 使用 LLM 提取新记忆
    const result = await extractMemoriesWithLLM(script, episodeNum, existingText, modelLog)

    // 保存到数据库
    const items: CreateMemoryItemInput[] = result.memories.map((m) => ({
      projectId,
      type: m.type,
      category: m.category,
      title: m.title,
      content: m.content,
      tags: m.tags,
      importance: m.importance,
      episodeId,
      metadata: m.metadata
    }))

    if (items.length > 0) {
      await this.repo.bulkCreate(items)
    }

    return {
      extracted: result.memories.length,
      saved: items.length,
      cost: result.cost
    }
  }

  /**
   * 构建剧本写作上下文
   */
  async getEpisodeWritingContext(projectId: string, targetEpisodeNum: number) {
    return buildEpisodeWritingContext(this.repo, projectId, targetEpisodeNum)
  }

  /**
   * 构建分镜上下文
   */
  async getStoryboardContext(projectId: string, episodeId: string) {
    return buildStoryboardContext(this.repo, projectId, episodeId)
  }

  /**
   * 查询记忆
   */
  async queryMemories(projectId: string, filters?: Record<string, unknown>) {
    return this.repo.findByProject(projectId, filters)
  }

  /**
   * 更新记忆
   */
  async updateMemory(memoryId: string, data: Record<string, unknown>) {
    return this.repo.update(memoryId, data)
  }

  /**
   * 删除记忆
   */
  async deleteMemory(memoryId: string) {
    return this.repo.delete(memoryId)
  }

  /**
   * 搜索记忆
   */
  async searchMemories(projectId: string, query: string, limit: number = 10) {
    return this.repo.findSimilar(projectId, query, limit)
  }

  /**
   * 同步剧本记忆到项目记忆
   * 幂等操作：按 type + title 进行 upsert
   */
  async syncScriptMemoriesToProject(
    scriptId: string,
    projectId: string
  ): Promise<{ synced: number }> {
    // 查询剧本记忆
    const scriptMemories = await prisma.scriptMemoryItem.findMany({
      where: {
        scriptId,
        isActive: true
      }
    })

    let syncedCount = 0

    for (const sm of scriptMemories) {
      // 查找是否已存在相同 type + title 的项目记忆
      const existing = await prisma.memoryItem.findFirst({
        where: {
          projectId,
          type: sm.type as any,
          title: sm.title
        }
      })

      if (existing) {
        // 更新现有记忆
        await prisma.memoryItem.update({
          where: { id: existing.id },
          data: {
            content: sm.content,
            metadata: sm.metadata as any,
            tags: sm.tags,
            importance: sm.importance,
            category: sm.category,
            updatedAt: new Date()
          }
        })
      } else {
        // 创建新记忆
        await prisma.memoryItem.create({
          data: {
            projectId,
            type: sm.type as any,
            title: sm.title,
            content: sm.content,
            metadata: sm.metadata as any,
            tags: sm.tags,
            importance: sm.importance,
            category: sm.category,
            isActive: sm.isActive
          }
        })
      }

      syncedCount++
    }

    return { synced: syncedCount }
  }
}

// 单例导出
let memoryServiceInstance: MemoryService | null = null

export function getMemoryService(): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService(new MemoryRepository())
  }
  return memoryServiceInstance
}
