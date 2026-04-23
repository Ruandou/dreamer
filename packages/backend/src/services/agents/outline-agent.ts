/**
 * 大纲生成 Agent
 * 基于用户意图和上下文生成结构化剧本大纲
 */

import { getDefaultProvider } from '../ai/llm-factory.js'
import {
  callLLMWithRetry,
  streamLLMWithRetry,
  collectStreamedJSON
} from '../ai/llm-call-wrapper.js'
import type { LLMMessage } from '../ai/llm-provider.js'
import type { ParsedIntent, WritingContext, OutlineOutput, AgentStreamEvent } from './types.js'

const OUTLINE_AGENT_SYSTEM_PROMPT = `你是一个专业的剧本大纲生成助手。你的任务是基于用户意图和上下文信息，生成结构化的剧本大纲。

输出要求：
1. 大纲应包含完整的剧集结构
2. 每集需要有明确的标题、简介和关键场景
3. 确保角色、设定、情节连贯一致
4. 考虑前情摘要（如果提供）

请以 JSON 格式返回：
{
  "title": "剧本标题",
  "episodeCount": 集数,
  "episodes": [
    {
      "episodeNum": 1,
      "title": "第一集标题",
      "synopsis": "第一集简介（100-200字）",
      "keyScenes": ["场景1", "场景2", "场景3"]
    }
  ]
}

规则：
- 确保故事有明确的起承转合
- 每集之间有清晰的推进关系
- 角色动机合理
- 关键场景要具体且有戏剧冲突
- 只返回 JSON，不要添加任何解释`

export class OutlineAgent {
  /**
   * 生成剧本大纲
   */
  async generate(
    userId: string,
    intent: ParsedIntent,
    context: WritingContext
  ): Promise<OutlineOutput> {
    // 构建用户提示词
    const userPrompt = this.buildUserPrompt(intent, context)

    const messages: LLMMessage[] = [
      { role: 'system', content: OUTLINE_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    const provider = getDefaultProvider()

    try {
      const result = await callLLMWithRetry(
        {
          provider,
          messages,
          temperature: 0.8,
          maxTokens: 4000,
          modelLog: {
            userId,
            op: 'outline_generation'
          }
        },
        (content) => {
          const outline = JSON.parse(content) as OutlineOutput
          return outline
        }
      )

      return result.content
    } catch (error) {
      throw new Error(
        `Outline generation failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      )
    }
  }

  /**
   * 生成剧本大纲（流式版本）
   */
  async *generateStream(
    userId: string,
    intent: ParsedIntent,
    context: WritingContext
  ): AsyncGenerator<AgentStreamEvent> {
    // 发送步骤开始事件
    yield {
      type: 'step_start',
      step: 'outline_generation',
      stepNumber: 2,
      totalSteps: 5,
      stepLabel: '生成大纲',
      isStreaming: false
    }

    const userPrompt = this.buildUserPrompt(intent, context)
    const messages: LLMMessage[] = [
      { role: 'system', content: OUTLINE_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    const provider = getDefaultProvider()

    try {
      const stream = streamLLMWithRetry({
        provider,
        messages,
        temperature: 0.8,
        maxTokens: 4000,
        modelLog: {
          userId,
          op: 'outline_generation'
        }
      })

      // 收集 JSON 输出
      const outline = await collectStreamedJSON<OutlineOutput>(stream)

      // 发送完成事件
      yield {
        type: 'step_complete',
        step: 'outline_generation',
        stepNumber: 2,
        totalSteps: 5,
        result: {
          type: 'outline',
          content: outline,
          summary: `共 ${outline.episodeCount} 集`
        },
        requiresUserAction: true,
        actionLabel: '确认大纲'
      }
    } catch (error) {
      throw new Error(
        `Outline generation failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      )
    }
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(intent: ParsedIntent, context: WritingContext): string {
    const parts: string[] = []

    parts.push(`用户指令：${intent.rawCommand}`)
    parts.push('')

    if (intent.parameters.genre) {
      parts.push(`类型：${intent.parameters.genre}`)
    }
    if (intent.parameters.theme) {
      parts.push(`主题：${intent.parameters.theme}`)
    }
    if (intent.parameters.characters && intent.parameters.characters.length > 0) {
      parts.push(`角色：${intent.parameters.characters.join('、')}`)
    }
    if (intent.parameters.setting) {
      parts.push(`背景：${intent.parameters.setting}`)
    }
    if (intent.parameters.episodeCount) {
      parts.push(`建议集数：${intent.parameters.episodeCount}`)
    }
    if (intent.parameters.tone) {
      parts.push(`基调：${intent.parameters.tone}`)
    }

    parts.push('')

    // 添加项目上下文
    if (context.projectSettings) {
      parts.push('## 项目设置')
      parts.push(`标题：${context.projectSettings.title}`)
      if (context.projectSettings.synopsis) {
        parts.push(`简介：${context.projectSettings.synopsis}`)
      }
      if (context.projectSettings.style) {
        parts.push(`风格：${context.projectSettings.style}`)
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
      context.scriptMemories.slice(0, 20).forEach((memory) => {
        parts.push(`- [${memory.type}] ${memory.title}: ${memory.content.substring(0, 100)}`)
      })
      parts.push('')
    }

    parts.push('请基于以上信息生成完整的剧本大纲。')

    return parts.join('\n')
  }
}

export const outlineAgent = new OutlineAgent()
