import type { ModelCallLogContext } from './api-logger.js'
import type { DeepSeekCost } from './deepseek-client.js'
import { callLLMWithRetry, type LLMCallOptions } from './llm-call-wrapper.js'
import { getDefaultProvider, type LLMProvider } from './llm-factory.js'
import { PromptRegistry } from '../prompts/registry.js'
import type { LLMMessage } from './llm-provider.js'

/** 与《DREAMER_AI_PROMPT_GUIDE》3.2 / 3.3 及批量视觉补全对齐的单槽提示词约束 */
function characterSlotSystemPrompt(slotType: string): string {
  const t = (slotType || 'base').toLowerCase()
  if (t === 'base') {
    return '你是短剧角色基础定妆提示词撰写助手。只输出中文提示词正文；须纯色影棚背景、七分身（膝盖以上）、锚定面部与发型与基础服装，句间用句号；除专有名词外不要使用英文。'
  }
  if (t === 'outfit') {
    return '你是短剧角色换装提示词撰写助手。只输出中文提示词正文；必须强调面部特征、发型与标志性细节完全不变，仅更换服装与配饰；纯色影棚背景；除专有名词外不要使用英文。'
  }
  return '你是短剧角色定妆提示词撰写助手。只输出中文提示词正文；相对父级基础形象保持人物身份一致，描述表情或体态等「仅变化」部分；除专有名词外不要使用英文。'
}

function characterSlotExtraInstructions(slotType: string): string[] {
  const t = (slotType || 'base').toLowerCase()
  if (t === 'base') {
    return [
      '【基础定妆】站立于纯色影棚背景（如中灰色）；七分身构图（膝盖以上）；四段意合为一段：（1）主体与外貌（2）发型与标志（3）服装与姿态（4）构图与背景须点明七分身与纯色底，并含画质词；整体不超过约120字。',
      '禁止只写剧情动作，须写「长什么样、穿什么」。'
    ]
  }
  if (t === 'outfit') {
    return [
      '【换装】采用：保持该角色面部特征、发型与标志性细节完全不变，仅将服装更换为：……（结合槽位说明）。纯色影棚背景。整体不超过约100字。',
      '若已提供父级基础形象参考，须与之为同一人，勿写成新角色。'
    ]
  }
  return [
    '【衍生形象】相对父级基础形象保持身份一致；中文写清仅变化部分（表情或姿态等），背景以纯色或简单棚拍为宜。'
  ]
}

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
