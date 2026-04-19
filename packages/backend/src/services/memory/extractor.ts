import { PromptRegistry } from '../prompts/registry.js'
import { getDefaultProvider, type LLMProvider } from '../ai/llm-factory.js'
import type { LLMMessage } from '../ai/llm-provider.js'
import { callLLMWithRetry, type LLMCallOptions } from '../ai/llm-call-wrapper.js'
import type { MemoryType } from '../../repositories/memory-repository.js'
import type { ScriptContent } from '@dreamer/shared/types'
import type { ModelCallLogContext } from '../ai/api-logger.js'

export interface ExtractedMemory {
  type: MemoryType
  category?: string
  title: string
  content: string
  tags: string[]
  importance: number
  metadata?: Record<string, unknown>
}

export interface MemoryExtractionResult {
  memories: ExtractedMemory[]
  cost: { costCNY: number }
}

/**
 * 从剧本中提取剧情记忆
 */
export async function extractMemoriesWithLLM(
  script: ScriptContent,
  episodeNum: number,
  existingMemories: string = '',
  modelLog?: ModelCallLogContext,
  provider?: LLMProvider
): Promise<MemoryExtractionResult> {
  const llmProvider = provider || getDefaultProvider()
  const template = PromptRegistry.getInstance().getLatest('memory-extraction')

  // 将剧本对象转为可读的文本格式，而不是 JSON
  const scriptText = formatScriptForExtraction(script)

  const rendered = PromptRegistry.getInstance().render('memory-extraction', {
    episodeNum: String(episodeNum),
    script: scriptText,
    existingMemories: existingMemories || ''
  })

  const messages: LLMMessage[] = [
    { role: 'system', content: rendered.systemPrompt },
    { role: 'user', content: rendered.userPrompt }
  ]

  const parseMemories = (content: string): MemoryExtractionResult => {
    // 清理 markdown 代码块
    const cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(cleanContent) as { memories?: unknown[] }

    if (!parsed.memories || !Array.isArray(parsed.memories)) {
      throw new Error('Invalid memory extraction response: missing memories array')
    }

    const memories: ExtractedMemory[] = (parsed.memories as Record<string, unknown>[]).map((m) => ({
      type: m.type as MemoryType,
      category: String(m.category ?? ''),
      title: String(m.title ?? ''),
      content: String(m.content ?? ''),
      tags: (Array.isArray(m.tags) ? m.tags : []) as string[],
      importance: (m.importance as number) || 3,
      metadata: (m.metadata as Record<string, unknown>) || {}
    }))

    return {
      memories,
      cost: { costCNY: 0 } // Will be filled by callLLMWithRetry
    }
  }

  const options: LLMCallOptions = {
    provider: llmProvider,
    messages,
    temperature: template.metadata.creativity,
    maxTokens: template.metadata.maxOutputTokens,
    modelLog
  }

  const result = await callLLMWithRetry(options, parseMemories)

  return {
    memories: result.content.memories,
    cost: result.cost
  }
}

/**
 * 将剧本对象格式化为可读文本（用于记忆提取）
 */
function formatScriptForExtraction(script: ScriptContent): string {
  const lines: string[] = []

  // 标题和概要
  if (script.title) {
    lines.push(`# ${script.title}`)
    lines.push('')
  }

  if (script.summary) {
    lines.push(`## 概要`)
    lines.push(script.summary)
    lines.push('')
  }

  // 场景
  if (script.scenes && script.scenes.length > 0) {
    lines.push(`## 场景 (${script.scenes.length}个)`)
    lines.push('')

    script.scenes.forEach((scene, index) => {
      lines.push(`### 场景 ${index + 1}: ${scene.location || '未知场地'}`)
      if (scene.timeOfDay) lines.push(`时间: ${scene.timeOfDay}`)
      if (scene.characters && scene.characters.length > 0) {
        lines.push(`出场角色: ${scene.characters.join('、')}`)
      }
      lines.push('')

      if (scene.description) {
        lines.push(`**场景描述:**`)
        lines.push(scene.description)
        lines.push('')
      }

      if (scene.dialogues && scene.dialogues.length > 0) {
        lines.push(`**对话:**`)
        scene.dialogues.forEach((d) => {
          lines.push(`${d.character}: ${d.content}`)
        })
        lines.push('')
      }

      if (scene.actions && scene.actions.length > 0) {
        lines.push(`**动作:**`)
        scene.actions.forEach((a) => {
          lines.push(a)
        })
        lines.push('')
      }
    })
  }

  return lines.join('\n')
}

/**
 * 格式化已有记忆为字符串（用于提示词）
 */
export function formatExistingMemories(
  memories: Array<{
    type: string
    title: string
    content: string
  }>
): string {
  if (memories.length === 0) return ''

  return memories.map((m) => `- [${m.type}] ${m.title}: ${m.content}`).join('\n')
}
