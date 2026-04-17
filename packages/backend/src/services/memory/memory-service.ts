import {
  MemoryRepository,
  type CreateMemoryItemInput
} from '../../repositories/memory-repository.js'
import { extractMemoriesWithLLM, formatExistingMemories } from './extractor.js'
import { buildEpisodeWritingContext, buildStoryboardContext } from './context-builder.js'
import type { ScriptContent } from '@dreamer/shared/types'
import type { ModelCallLogContext } from '../../types/index.js'

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
  async queryMemories(projectId: string, filters?: any) {
    return this.repo.findByProject(projectId, filters)
  }

  /**
   * 更新记忆
   */
  async updateMemory(memoryId: string, data: any) {
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
}

// 单例导出
let memoryServiceInstance: MemoryService | null = null

export function getMemoryService(): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService(new MemoryRepository())
  }
  return memoryServiceInstance
}
