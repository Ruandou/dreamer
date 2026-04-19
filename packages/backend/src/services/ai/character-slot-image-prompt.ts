import type { ModelCallLogContext } from './api-logger.js'
import type { DeepSeekCost } from './deepseek-client.js'
import { callLLMWithRetry, type LLMCallOptions } from './llm-call-wrapper.js'
import { getDefaultProvider, type LLMProvider } from './llm-factory.js'
import { PromptRegistry } from '../prompts/registry.js'
import type { LLMMessage } from './llm-provider.js'

/** 为角色形象槽位生成中文文生图提示词（单行，无 markdown），便于用户阅读且适配国产绘图模型 */
export async function generateCharacterSlotImagePrompt(
  input: {
    characterName: string
    characterDescription?: string | null
    slotName: string
    slotType: string
    slotDescription?: string | null
    parentSlotSummary?: string | null
  },
  log?: ModelCallLogContext,
  provider?: LLMProvider // 新增：可选的自定义提供者
): Promise<{ prompt: string; cost: DeepSeekCost }> {
  const llmProvider = provider || getDefaultProvider()

  // 根据槽位类型选择模板
  const templateId =
    input.slotType === 'base'
      ? 'character-base-prompt'
      : input.slotType === 'outfit'
        ? 'character-outfit-prompt'
        : 'character-expression-prompt'

  const rendered = PromptRegistry.getInstance().render(templateId, {
    characterName: input.characterName,
    characterDescription: input.characterDescription || '',
    slotName: input.slotName,
    slotType: input.slotType,
    slotDescription: input.slotDescription || '',
    parentSlotSummary: input.parentSlotSummary || ''
  })

  const messages: LLMMessage[] = [
    { role: 'system', content: rendered.systemPrompt },
    { role: 'user', content: rendered.userPrompt }
  ]

  // Parser function for the wrapper
  const parsePrompt = (content: string): string => {
    return content.replace(/^['"]|['"]$/g, '').trim()
  }

  const options: LLMCallOptions = {
    provider: llmProvider,
    messages,
    modelLog: log
  }

  const result = await callLLMWithRetry(options, parsePrompt)

  return {
    prompt: result.content,
    cost: result.cost
  }
}
