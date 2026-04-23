/**
 * 草稿生成 Agent
 * 基于大纲和上下文生成完整剧本文稿
 */

import { getDefaultProvider } from '../ai/llm-factory.js'
import { callLLMWithRetry, streamLLMWithRetry } from '../ai/llm-call-wrapper.js'
import type { LLMMessage } from '../ai/llm-provider.js'
import type {
  WritingContext,
  OutlineOutput,
  ScriptContent,
  AgentStreamEvent,
  AgentTokenEvent
} from './types.js'

const DRAFT_AGENT_SYSTEM_PROMPT = `你是一个专业的剧本文稿生成助手。你的任务是基于剧本大纲和上下文信息，生成完整的剧本文稿。

输出格式要求（标准剧本格式）：
Scene 1. 场景名称 - 时间

场景描述（环境、氛围、动作）

角色名："台词内容"

（舞台指示）

角色名："台词内容"

---

Scene 2. ...

规则：
1. 每个场景都要有清晰的编号和名称
2. 场景描述要具体，包含环境、时间、氛围
3. 角色对话要符合角色性格和背景
4. 保持情节连贯性
5. 场景之间要有合理的过渡
6. 只返回剧本内容，不要添加任何解释或说明
7. 生成完整的剧本，包括所有场景`

export class DraftAgent {
  /**
   * 生成剧本文稿
   */
  async generate(
    userId: string,
    outline: OutlineOutput,
    context: WritingContext,
    targetEpisode?: number
  ): Promise<ScriptContent> {
    // 如果指定了集数，只生成该集
    const episodesToGenerate = targetEpisode
      ? outline.episodes.filter((ep) => ep.episodeNum === targetEpisode)
      : outline.episodes

    // 构建用户提示词
    const userPrompt = this.buildUserPrompt(outline, context, episodesToGenerate)

    const provider = getDefaultProvider()

    const messages: LLMMessage[] = [
      { role: 'system', content: DRAFT_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    const result = await callLLMWithRetry(
      {
        provider,
        messages,
        temperature: 0.9,
        maxTokens: 8000,
        model: 'deepseek-chat',
        modelLog: {
          userId,
          op: 'draft_generation'
        }
      },
      (content) => content
    )

    // 返回结构化内容
    return {
      title: outline.title,
      content: result.content,
      scenes: this.parseScenesFromContent(result.content)
    }
  }

  /**
   * 生成剧本文稿（流式版本）
   */
  async *generateStream(
    userId: string,
    outline: OutlineOutput,
    context: WritingContext,
    targetEpisode?: number
  ): AsyncGenerator<AgentStreamEvent> {
    const episodesToGenerate = targetEpisode
      ? outline.episodes.filter((ep) => ep.episodeNum === targetEpisode)
      : outline.episodes

    const userPrompt = this.buildUserPrompt(outline, context, episodesToGenerate)

    const provider = getDefaultProvider()

    const messages: LLMMessage[] = [
      { role: 'system', content: DRAFT_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    // 发送步骤开始事件
    yield {
      type: 'step_start',
      step: 'draft_generation',
      stepNumber: 3,
      totalSteps: 5,
      stepLabel: '生成草稿',
      isStreaming: true
    }

    try {
      let fullContent = ''

      // 流式输出 token
      for await (const chunk of streamLLMWithRetry({
        provider,
        messages,
        temperature: 0.9,
        maxTokens: 8000,
        model: 'deepseek-chat',
        modelLog: {
          userId,
          op: 'draft_generation'
        }
      })) {
        if (chunk.delta) {
          fullContent += chunk.delta

          // 发送 token 事件
          yield {
            type: 'token',
            step: 'draft_generation',
            stepNumber: 3,
            totalSteps: 5,
            content: chunk.delta
          } as AgentTokenEvent
        }
      }

      // 发送完成事件
      yield {
        type: 'step_complete',
        step: 'draft_generation',
        stepNumber: 3,
        totalSteps: 5,
        result: {
          type: 'draft',
          content: {
            title: outline.title,
            content: fullContent,
            scenes: this.parseScenesFromContent(fullContent)
          },
          summary: '草稿已生成'
        },
        requiresUserAction: true,
        actionLabel: '确认草稿'
      }
    } catch (error) {
      throw new Error(
        `Draft generation failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      )
    }
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(
    outline: OutlineOutput,
    context: WritingContext,
    episodes: Array<{ episodeNum: number; title: string; synopsis: string; keyScenes: string[] }>
  ): string {
    const parts: string[] = []

    parts.push(`## 剧本标题：${outline.title}`)
    parts.push(`总集数：${outline.episodeCount}`)
    parts.push('')

    parts.push('## 需要生成的集')
    episodes.forEach((ep) => {
      parts.push(`### 第${ep.episodeNum}集：${ep.title}`)
      parts.push(`简介：${ep.synopsis}`)
      parts.push(`关键场景：${ep.keyScenes.join('、')}`)
      parts.push('')
    })

    // 添加项目上下文
    if (context.projectSettings) {
      parts.push('## 项目设置')
      parts.push(`标题：${context.projectSettings.title}`)
      if (context.projectSettings.synopsis) {
        parts.push(`简介：${context.projectSettings.synopsis}`)
      }
      if (context.projectSettings.characters.length > 0) {
        parts.push('已有角色：')
        context.projectSettings.characters.forEach((c) => {
          parts.push(`- ${c.name}: ${c.description || '无描述'}`)
        })
      }
      parts.push('')
    }

    // 添加前情摘要
    if (context.previousEpisodes && context.previousEpisodes.length > 0) {
      parts.push('## 前情摘要')
      context.previousEpisodes.forEach((ep) => {
        parts.push(`第${ep.episodeNum}集：${ep.synopsis}`)
      })
      parts.push('')
    }

    // 添加剧本记忆
    if (context.scriptMemories.length > 0) {
      parts.push('## 剧本记忆')
      context.scriptMemories.slice(0, 30).forEach((memory) => {
        parts.push(`- [${memory.type}] ${memory.title}: ${memory.content.substring(0, 150)}`)
      })
      parts.push('')
    }

    parts.push('请按照标准剧本格式生成完整的剧本文稿。确保每个场景都有清晰的编号、描述和对话。')

    return parts.join('\n')
  }

  /**
   * 从内容中解析场景
   */
  private parseScenesFromContent(content: string): ScriptContent['scenes'] {
    const scenes: ScriptContent['scenes'] = []
    const sceneRegex = /Scene\s+(\d+)\.\s*(.+?)\s*-\s*(.+?)\n([\s\S]*?)(?=Scene\s+\d+\.|$)/g

    let match
    while ((match = sceneRegex.exec(content)) !== null) {
      const sceneNum = parseInt(match[1], 10)
      const description = match[4].trim()

      // 解析对话
      const dialogues: Array<{ character: string; text: string }> = []
      const dialogueRegex = /([^："]+)："([^"]+)"/g
      let dialogueMatch

      while ((dialogueMatch = dialogueRegex.exec(description)) !== null) {
        dialogues.push({
          character: dialogueMatch[1].trim(),
          text: dialogueMatch[2]
        })
      }

      scenes.push({
        sceneNum,
        location: match[2].trim(),
        timeOfDay: match[3].trim(),
        description,
        dialogues
      })
    }

    return scenes
  }
}

export const draftAgent = new DraftAgent()
