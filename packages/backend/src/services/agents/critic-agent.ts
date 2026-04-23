/**
 * 内部审核 Agent
 * 对生成的草稿进行质量评估，不展示给用户
 */

import { getDefaultProvider } from '../ai/llm-factory.js'
import {
  callLLMWithRetry,
  streamLLMWithRetry,
  cleanMarkdownCodeBlocks,
  collectStreamedJSON
} from '../ai/llm-call-wrapper.js'
import type { LLMMessage } from '../ai/llm-provider.js'
import type { OutlineOutput, ScriptContent, AgentStreamEvent } from './types.js'

const CRITIC_AGENT_SYSTEM_PROMPT = `你是一个专业的剧本审核编辑。你的任务是对生成的剧本进行质量评估。

评估维度：
1. 连贯性（Coherence）：情节是否连贯，逻辑是否自洽
2. 角色一致性（Character Consistency）：角色行为是否符合设定
3. 场景质量（Scene Quality）：场景描述是否生动，对话是否自然
4. 戏剧冲突（Dramatic Conflict）：是否有足够的冲突和张力
5. 格式规范（Format）：是否符合标准剧本格式

请以 JSON 格式返回：
{
  "scores": {
    "coherence": 0-100,
    "characterConsistency": 0-100,
    "sceneQuality": 0-100,
    "dramaticConflict": 0-100,
    "format": 0-100
  },
  "overallScore": 0-100,
  "feedback": "具体的修改建议（3-5条）",
  "strengths": "优点（1-2条）",
  "weaknesses": "需要改进的地方（1-2条）"
}

评分标准：
- 90-100: 优秀，几乎无需修改
- 75-89: 良好，少量修改即可
- 60-74: 一般，需要较多修改
- 0-59: 较差，建议重写

只返回 JSON，不要添加任何解释`

export interface CritiqueResult {
  scores: {
    coherence: number
    characterConsistency: number
    sceneQuality: number
    dramaticConflict: number
    format: number
  }
  overallScore: number
  feedback: string
  strengths: string
  weaknesses: string
}

export class CriticAgent {
  /**
   * 审核剧本文稿
   */
  async critique(
    userId: string,
    draft: ScriptContent,
    outline: OutlineOutput
  ): Promise<CritiqueResult> {
    const userPrompt = this.buildUserPrompt(draft, outline)

    const provider = getDefaultProvider()

    const messages: LLMMessage[] = [
      { role: 'system', content: CRITIC_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    try {
      const result = await callLLMWithRetry(
        {
          provider,
          messages,
          temperature: 0.3,
          maxTokens: 2000,
          model: 'deepseek-chat',
          modelLog: {
            userId,
            op: 'critique'
          },
          extra: {
            response_format: { type: 'json_object' }
          }
        },
        (content) => {
          const cleaned = cleanMarkdownCodeBlocks(content)
          return JSON.parse(cleaned) as CritiqueResult
        }
      )

      return result.content
    } catch {
      return {
        scores: {
          coherence: 70,
          characterConsistency: 70,
          sceneQuality: 70,
          dramaticConflict: 70,
          format: 70
        },
        overallScore: 70,
        feedback: '审核失败，使用默认评分',
        strengths: '内容已生成',
        weaknesses: '需要人工审核'
      }
    }
  }

  /**
   * 审核剧本文稿（流式版本）
   */
  async *critiqueStream(
    userId: string,
    draft: ScriptContent,
    outline: OutlineOutput
  ): AsyncGenerator<AgentStreamEvent> {
    const userPrompt = this.buildUserPrompt(draft, outline)

    const provider = getDefaultProvider()

    const messages: LLMMessage[] = [
      { role: 'system', content: CRITIC_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    try {
      const stream = streamLLMWithRetry({
        provider,
        messages,
        temperature: 0.3,
        maxTokens: 2000,
        model: 'deepseek-chat',
        modelLog: {
          userId,
          op: 'critique'
        },
        extra: {
          response_format: { type: 'json_object' }
        }
      })

      const critique = await collectStreamedJSON<CritiqueResult>(stream)

      yield {
        type: 'step_complete',
        step: 'critique',
        stepNumber: 4,
        totalSteps: 5,
        result: {
          type: 'critique',
          content: `评分：${critique.overallScore}/100\n反馈：${critique.feedback}`,
          summary: `评分：${critique.overallScore}/100`
        },
        requiresUserAction: false,
        actionLabel: ''
      }
    } catch {
      yield {
        type: 'step_complete',
        step: 'critique',
        stepNumber: 4,
        totalSteps: 5,
        result: {
          type: 'critique',
          content: '审核失败，使用默认评分',
          summary: '审核失败'
        },
        requiresUserAction: false,
        actionLabel: ''
      }
    }
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(draft: ScriptContent, outline: OutlineOutput): string {
    const parts: string[] = []

    parts.push(`## 剧本标题：${draft.title}`)
    parts.push('')

    parts.push('## 大纲要求')
    parts.push(`总集数：${outline.episodeCount}`)
    outline.episodes.slice(0, 3).forEach((ep) => {
      parts.push(`第${ep.episodeNum}集：${ep.title} - ${ep.synopsis.substring(0, 100)}`)
    })
    parts.push('')

    parts.push('## 剧本文稿')
    const contentPreview = draft.content.substring(0, 6000)
    parts.push(contentPreview)
    if (draft.content.length > 6000) {
      parts.push('\n...（内容已截断）')
    }

    parts.push('')
    parts.push('请根据以上大纲要求和剧本文稿进行质量评估。')

    return parts.join('\n')
  }
}

export const criticAgent = new CriticAgent()
