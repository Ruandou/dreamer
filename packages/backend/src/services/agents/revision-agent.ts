/**
 * 自动修改 Agent
 * 根据审核反馈自动修改剧本文稿
 */

import { getProviderForModel } from '../ai/llm/llm-factory.js'
import { callLLMWithRetry, streamLLMWithRetry } from '../ai/llm-call-wrapper.js'
import type { LLMMessage } from '../ai/llm-provider.js'
import type { ScriptContent, AgentStreamEvent, AgentTokenEvent } from './types.js'
import type { CritiqueResult } from './critic-agent.js'

const REVISION_AGENT_SYSTEM_PROMPT = `你是一个专业的剧本修改助手。你的任务是根据审核反馈对剧本进行修改。

修改规则：
1. 仔细阅读审核反馈中的修改建议
2. 针对性地修改剧本内容，解决提出的问题
3. 保持剧本的整体风格和连贯性
4. 不要删除重要内容，而是在基础上改进
5. 只返回修改后的完整剧本内容，不要添加任何解释或说明

审核反馈包括：
- feedback: 具体的修改建议
- weaknesses: 需要改进的地方
- strengths: 优点（保持这些优点）`

export class RevisionAgent {
  /**
   * 修改剧本文稿
   */
  async revise(
    userId: string,
    draft: ScriptContent,
    critique: CritiqueResult,
    _maxRetries: number = 3,
    model?: string
  ): Promise<ScriptContent> {
    const userPrompt = this.buildUserPrompt(draft, critique)

    const provider = getProviderForModel(model)

    const messages: LLMMessage[] = [
      { role: 'system', content: REVISION_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    const result = await callLLMWithRetry(
      {
        provider,
        messages,
        temperature: 0.7,
        maxTokens: 8000,
        model,
        modelLog: {
          userId,
          op: 'revision'
        }
      },
      (content) => content
    )

    return {
      ...draft,
      content: result.content,
      scenes: draft.scenes
    }
  }

  /**
   * 修改剧本文稿（流式版本）
   */
  async *reviseStream(
    userId: string,
    draft: ScriptContent,
    critique: CritiqueResult,
    model?: string
  ): AsyncGenerator<AgentStreamEvent> {
    const userPrompt = this.buildUserPrompt(draft, critique)

    const provider = getProviderForModel(model)

    const messages: LLMMessage[] = [
      { role: 'system', content: REVISION_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]

    try {
      let fullContent = ''

      for await (const chunk of streamLLMWithRetry({
        provider,
        messages,
        temperature: 0.7,
        maxTokens: 8000,
        model,
        modelLog: {
          userId,
          op: 'revision'
        }
      })) {
        if (chunk.delta) {
          fullContent += chunk.delta

          yield {
            type: 'token',
            step: 'revision',
            stepNumber: 4,
            totalSteps: 5,
            content: chunk.delta
          } as AgentTokenEvent
        }
      }

      yield {
        type: 'step_complete',
        step: 'revision',
        stepNumber: 4,
        totalSteps: 5,
        result: {
          type: 'revision',
          content: {
            ...draft,
            content: fullContent
          },
          summary: '草稿已修改'
        },
        requiresUserAction: true,
        actionLabel: '确认修改'
      }
    } catch (error) {
      throw new Error(
        `Revision failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      )
    }
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(draft: ScriptContent, critique: CritiqueResult): string {
    const parts: string[] = []

    parts.push(`## 剧本标题：${draft.title}`)
    parts.push('')

    parts.push('## 审核反馈')
    parts.push(`总体评分：${critique.overallScore}/100`)
    parts.push('')

    parts.push('### 修改建议')
    parts.push(critique.feedback)
    parts.push('')

    parts.push('### 需要改进的地方')
    parts.push(critique.weaknesses)
    parts.push('')

    parts.push('### 优点（请保持）')
    parts.push(critique.strengths)
    parts.push('')

    parts.push('## 当前剧本内容')
    const contentPreview = draft.content.substring(0, 6000)
    parts.push(contentPreview)
    if (draft.content.length > 6000) {
      parts.push('\n...（内容已截断）')
    }

    parts.push('')
    parts.push('请根据审核反馈修改剧本。')

    return parts.join('\n')
  }
}

export const revisionAgent = new RevisionAgent()
