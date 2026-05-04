/**
 * 记忆提取服务
 * 从生成的 Outline/Draft 中提取记忆点并保存到 ScriptMemoryItem
 */

import { prisma } from '../../lib/prisma.js'
import type { MemoryType } from '@prisma/client'
import { getProviderForModel, getProviderForUser } from '../ai/llm/llm-factory.js'
import { callLLMWithRetry, cleanMarkdownCodeBlocks } from '../ai/llm-call-wrapper.js'
import type { LLMMessage } from '../ai/llm-provider.js'
import type { OutlineOutput, ScriptContent, ScriptMemoryItem } from './types.js'

const MEMORY_EXTRACTOR_SYSTEM_PROMPT = `你是一个专业的剧本记忆提取助手。你的任务是从剧本内容中提取关键记忆点。

需要提取的记忆类型：
1. CHARACTER（角色）：主要角色、特征、关系
2. LOCATION（地点）：重要场景、环境描述
3. EVENT（事件）：关键情节、转折点
4. PLOT_POINT（情节点）：重要剧情发展
5. FORESHADOWING（伏笔）：暗示、铺垫
6. RELATIONSHIP（关系）：角色之间的关系
7. VISUAL_STYLE（视觉风格）：画面风格、色调

请以 JSON 数组格式返回，每个记忆项包含：
[
  {
    "type": "CHARACTER" | "LOCATION" | "EVENT" | "PLOT_POINT" | "FORESHADOWING" | "RELATIONSHIP" | "VISUAL_STYLE",
    "title": "简短标题",
    "content": "详细描述（100-200字）",
    "category": "细分类型（如 major_character, minor_location 等）",
    "importance": 1-5, // 5最重要
    "tags": ["标签1", "标签2"]
  }
]

规则：
1. 只提取重要的、对未来剧情有影响的信息
2. 角色记忆要包含外貌、性格、背景
3. 地点记忆要包含环境特征和氛围
4. 事件和情节点要包含时间和因果关系
5. 只返回 JSON 数组，不要添加任何解释`

export class MemoryExtractor {
  /**
   * 从大纲中提取记忆
   */
  async extractFromOutline(
    userId: string,
    scriptId: string,
    outline: OutlineOutput,
    model?: string
  ): Promise<ScriptMemoryItem[]> {
    const outlineText = outline.episodes
      .map(
        (ep) =>
          `第${ep.episodeNum}集：${ep.title}\n${ep.synopsis}\n关键场景：${ep.keyScenes.join('、')}`
      )
      .join('\n\n')

    const userPrompt = `请从以下剧本大纲中提取关键记忆点：\n\n剧本标题：${outline.title}\n总集数：${outline.episodeCount}\n\n${outlineText}`

    const memories = await this.callExtractionAPI(userId, userPrompt, model)

    // 保存到数据库
    const savedMemories = await this.saveMemories(scriptId, memories)

    return savedMemories
  }

  /**
   * 从草稿中提取记忆
   */
  async extractFromDraft(
    userId: string,
    scriptId: string,
    draft: ScriptContent,
    model?: string
  ): Promise<ScriptMemoryItem[]> {
    // 限制内容长度
    const contentPreview = draft.content.substring(0, 8000)
    const userPrompt = `请从以下剧本内容中提取关键记忆点：\n\n剧本标题：${draft.title}\n\n${contentPreview}`

    const memories = await this.callExtractionAPI(userId, userPrompt, model)

    // 保存到数据库
    const savedMemories = await this.saveMemories(scriptId, memories)

    return savedMemories
  }

  /**
   * 调用 LLM 进行记忆提取
   */
  private async callExtractionAPI(
    userId: string,
    userPrompt: string,
    model?: string
  ): Promise<
    Array<{
      type: string
      title: string
      content: string
      category?: string
      importance?: number
      tags?: string[]
    }>
  > {
    const messages: LLMMessage[] = [
      { role: 'system', content: MEMORY_EXTRACTOR_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    try {
      const provider = model ? getProviderForModel(model) : await getProviderForUser(userId)

      const result = await callLLMWithRetry(
        {
          provider,
          messages,
          temperature: 0.3,
          maxTokens: 4000,
          model,
          modelLog: {
            userId,
            op: 'memory_extraction'
          }
        },
        (content) => {
          const cleaned = cleanMarkdownCodeBlocks(content)
          const memories = JSON.parse(cleaned)
          return Array.isArray(memories) ? memories : []
        }
      )

      return result.content
    } catch {
      return []
    }
  }

  /**
   * 保存记忆到数据库
   */
  private async saveMemories(
    scriptId: string,
    memories: Array<{
      type: string
      title: string
      content: string
      category?: string
      importance?: number
      tags?: string[]
    }>
  ): Promise<ScriptMemoryItem[]> {
    const savedMemories: ScriptMemoryItem[] = []

    for (const memory of memories) {
      try {
        const created = await prisma.scriptMemoryItem.create({
          data: {
            scriptId,
            type: memory.type as MemoryType,
            title: memory.title,
            content: memory.content,
            category: memory.category,
            metadata: {},
            tags: memory.tags || [],
            importance: memory.importance ?? 3
          }
        })

        savedMemories.push({
          id: created.id,
          scriptId: created.scriptId,
          type: created.type,
          category: created.category,
          title: created.title,
          content: created.content,
          metadata: created.metadata as Record<string, unknown> | null,
          tags: created.tags,
          importance: created.importance,
          isActive: created.isActive,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt
        })
      } catch (error) {
        // 单条记忆保存失败不影响其他记忆
        console.error('Failed to save memory:', error)
      }
    }

    return savedMemories
  }
}

export const memoryExtractor = new MemoryExtractor()
