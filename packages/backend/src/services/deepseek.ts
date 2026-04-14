import OpenAI from 'openai'
import type { ScriptContent, ScriptScene, ScriptDialogueLine } from '@dreamer/shared/types'

// DeepSeek pricing (per 1M tokens) - 人民币定价
// 来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
const DEEPSEEK_INPUT_COST_PER_1M_CACHE_HIT = 0.2     // 元/百万tokens（缓存命中）
const DEEPSEEK_INPUT_COST_PER_1M_CACHE_MISS = 2.0    // 元/百万tokens（缓存未命中）
const DEEPSEEK_OUTPUT_COST_PER_1M = 3.0              // 元/百万tokens

export interface DeepSeekCost {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCNY: number  // 人民币成本
  cacheHit?: boolean  // 是否缓存命中
}

export class DeepSeekAuthError extends Error {
  constructor(message: string = 'DeepSeek API 认证失败，请检查 API Key') {
    super(message)
    this.name = 'DeepSeekAuthError'
  }
}

export class DeepSeekRateLimitError extends Error {
  constructor(message: string = 'DeepSeek API 请求过于频繁，请稍后重试') {
    super(message)
    this.name = 'DeepSeekRateLimitError'
  }
}

export interface DeepSeekBalance {
  isAvailable: boolean
  balanceInfos: Array<{
    currency: string
    totalBalance: number
    grantedBalance: number
    toppedUpBalance: number
  }>
}

export function calculateDeepSeekCost(usage: any, cacheHit: boolean = false): DeepSeekCost {
  const inputTokens = usage?.prompt_tokens || 0
  const outputTokens = usage?.completion_tokens || 0
  const totalTokens = usage?.total_tokens || 0

  // 根据缓存状态选择输入成本
  const inputCostPerMillion = cacheHit 
    ? DEEPSEEK_INPUT_COST_PER_1M_CACHE_HIT 
    : DEEPSEEK_INPUT_COST_PER_1M_CACHE_MISS

  // 计算人民币成本（直接使用人民币定价）
  const costCNY = (inputTokens / 1_000_000) * inputCostPerMillion +
                  (outputTokens / 1_000_000) * DEEPSEEK_OUTPUT_COST_PER_1M

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costCNY,
    cacheHit
  }
}

function getDeepSeekClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
  })
}

export async function getDeepSeekBalance(): Promise<DeepSeekBalance> {
  const response = await fetch('https://api.deepseek.com/user/balance', {
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to get DeepSeek balance: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    isAvailable: data.is_available,
    balanceInfos: (data.balance_infos || []).map((info: any) => ({
      currency: info.currency,
      totalBalance: parseFloat(info.total_balance),
      grantedBalance: parseFloat(info.granted_balance),
      toppedUpBalance: parseFloat(info.topped_up_balance)
    }))
  }
}

const SYSTEM_PROMPT = `你是一个专业的短剧剧本作家，擅长创作古装穿越/技术流逆袭类短剧。
请根据用户提供的故事梗概，扩展为结构化的短剧剧本。

剧本格式要求（必须严格遵循）：
{
  "title": "剧集标题",
  "summary": "故事梗概",
  "scenes": [
    {
      "sceneNum": 1,
      "location": "场景地点",
      "timeOfDay": "日/夜/晨/昏",
      "characters": ["角色1", "角色2"],
      "description": "场景描述",
      "dialogues": [
        {"character": "角色名", "content": "对话内容"}
      ],
      "actions": ["动作1", "动作2"]
    }
  ]
}

请直接返回JSON格式，不要包含其他文字。`

// 转换 DeepSeek 返回的格式到内部格式
export function convertDeepSeekResponse(data: any): ScriptContent {
  // 处理 DeepSeek 可能返回的嵌套结构
  let scenesArray: any[] = []

  if (Array.isArray(data.scenes)) {
    // 标准格式
    scenesArray = data.scenes
  } else if (Array.isArray(data.episodes) && data.episodes.length > 0) {
    // 嵌套 episodes[].scenes[] 格式
    scenesArray = data.episodes[0].scenes || []
  }

  const scenes: ScriptScene[] = scenesArray.map((s: any) => {
    // 处理 dialogues - 可能是数组或对象
    let dialogues: ScriptDialogueLine[] = []
    if (Array.isArray(s.dialogues)) {
      dialogues = s.dialogues.map((d: any) => ({
        character: d.character || d.name || '',
        content: d.content || d.line || ''
      }))
    } else if (s.dialogue && typeof s.dialogue === 'object') {
      // 对话是对象形式 { "角色名": "内容" }
      dialogues = Object.entries(s.dialogue).map(([character, content]) => ({
        character,
        content: content as string
      }))
    }

    // 处理 actions - 可能是字符串或数组
    let actions: string[] = []
    if (Array.isArray(s.actions)) {
      actions = s.actions
    } else if (typeof s.action === 'string') {
      // 将单个 action 字符串分割成数组
      actions = s.action.split(/(?<=[。！？；.!?;])/).filter(Boolean)
    }

    return {
      sceneNum: s.sceneNum || s.scene_number || 1,
      location: s.location || '',
      timeOfDay: s.timeOfDay || s.time || '日',
      characters: Array.isArray(s.characters) ? s.characters : [],
      description: s.description || '',
      dialogues,
      actions
    }
  })

  return {
    title: data.title || data.episode_title || '未命名剧本',
    summary: data.summary || '',
    scenes
  }
}

export async function expandScript(summary: string, projectContext?: string): Promise<{ script: ScriptContent; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  const userPrompt = projectContext
    ? `项目背景：${projectContext}\n\n故事梗概：${summary}`
    : `故事梗概：${summary}`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)

      // 清理返回内容，移除可能的 markdown 代码块
      let cleanContent = content
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }

      // 尝试解析JSON
      const rawScript = JSON.parse(cleanContent)

      // 转换格式
      const script = convertDeepSeekResponse(rawScript)

      // 验证结构
      if (!script.title || !Array.isArray(script.scenes)) {
        throw new Error('剧本格式不正确')
      }

      return { script, cost }
    } catch (error: any) {
      lastError = error

      // Handle specific errors
      if (error?.status === 401 || error?.status === 403) {
        throw new DeepSeekAuthError()
      }

      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
          continue
        }
        throw new DeepSeekRateLimitError()
      }

      // For content parsing errors, don't retry
      if (error.message === '剧本格式不正确' || error.message === 'DeepSeek API 返回为空') {
        throw error
      }

      // Other errors, retry once
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  throw lastError || new Error('剧本生成失败')
}

export async function optimizePrompt(prompt: string, context?: string): Promise<{ optimized: string; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  const userPrompt = context
    ? `上下文：${context}\n\n原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`
    : `原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的AI视频提示词优化专家。' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000
      })

      const cost = calculateDeepSeekCost(completion.usage)
      const optimized = completion.choices[0]?.message?.content || prompt

      return { optimized, cost }
    } catch (error: any) {
      lastError = error

      if (error?.status === 401 || error?.status === 403) {
        throw new DeepSeekAuthError()
      }

      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
          continue
        }
        throw new DeepSeekRateLimitError()
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  throw lastError || new Error('提示词优化失败')
}

/** 为角色形象槽位生成中文文生图提示词（单行，无 markdown），便于用户阅读且适配国产绘图模型 */
export async function generateCharacterSlotImagePrompt(input: {
  characterName: string
  characterDescription?: string | null
  slotName: string
  slotType: string
  slotDescription?: string | null
  parentSlotSummary?: string | null
}): Promise<{ prompt: string; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  try {
  const user = [
    `角色名：${input.characterName}`,
    input.characterDescription ? `角色设定：${input.characterDescription}` : '',
    `形象槽位名称：${input.slotName}`,
    `槽位类型：${input.slotType}（base 为基础定妆，outfit 为换装需与基础形象一致的人物特征）`,
    input.slotDescription ? `槽位说明：${input.slotDescription}` : '',
    input.parentSlotSummary ? `父级基础形象参考：${input.parentSlotSummary}` : '',
    '',
    '请输出一条中文的 AI 绘画提示词（写实或半写实风格、短剧角色定妆），只输出提示词正文，不要引号或解释。'
  ]
    .filter(Boolean)
    .join('\n')

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content:
          '你是短剧角色定妆提示词撰写助手。只输出中文提示词正文，可包含景别、光影、服装与材质等关键词；除专有名词外不要使用英文。'
      },
      { role: 'user', content: user }
    ],
    temperature: 0.6,
    max_tokens: 400
  })

  const cost = calculateDeepSeekCost(completion.usage)
  const raw = completion.choices[0]?.message?.content?.trim() || ''
  const prompt = raw.replace(/^["']|["']$/g, '').trim()
  if (!prompt) {
    throw new Error('DeepSeek API 返回为空')
  }
  return { prompt, cost }
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      throw new DeepSeekAuthError()
    }
    if (error?.status === 429 || error?.message?.includes('rate_limit')) {
      throw new DeepSeekRateLimitError()
    }
    throw error
  }
}

export async function fetchScriptVisualEnrichmentJson(input: {
  scriptSummary: string
  locationLines: string
  characterLines: string
}): Promise<{ jsonText: string; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  try {
  const user = [
    '根据下列剧本梗概与实体列表，输出 **仅一段合法 JSON**（不要 markdown 代码块），结构为：',
    '{"locations":[{"name":"场地名","imagePrompt":"中文定场图提示词"}],',
    '"characters":[{"name":"角色名","images":[{"name":"形象名","type":"base|outfit|expression|pose","description":"可选中文说明","prompt":"中文提示词"}]}]}',
    '',
    '规则（角色 images 数组顺序很重要）：',
    '1. 每个角色的 images 里 **必须先写至少 1 条 type 为 base 的定妆**（可与默认基础形象对应），再写衍生。',
    '2. **base**：prompt 为完整中文定妆/定装提示词，用作该角色主参考图（用户可直接阅读）。',
    '3. **outfit / expression / pose**（衍生）：必须相对上述 base 写「关联词」——用中文明确 **与 base 保持一致** 的部分（脸型、年龄感、五官比例、发型底色、体型等）以及 **仅变化** 的部分（服装款式与颜色 / 表情肌肉 / 体态与动作）。',
    '   推荐句式：与基础定妆为同一人；保持……不变；仅变化：……。禁止写成与 base 无关的全新人物设定。',
    '4. 有换装、明显表情或姿态差异时再追加衍生条目；无则不必凑数。',
    'locations 数组覆盖下列场地名；characters 覆盖下列角色名。',
    '',
    `剧本梗概：\n${input.scriptSummary.slice(0, 8000)}`,
    '',
    `场地（每行：名称 | 已有描述）：\n${input.locationLines || '(无)'}`,
    '',
    `角色（每行：名称 | 已有描述）：\n${input.characterLines || '(无)'}`
  ].join('\n')

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content:
          '你只输出紧凑的合法 JSON，供中文短剧生产工具使用；不要 markdown、不要解释。imagePrompt 与 prompt 字段一律使用中文。'
      },
      { role: 'user', content: user }
    ],
    temperature: 0.4,
    max_tokens: 4096
  })

  const cost = calculateDeepSeekCost(completion.usage)
  const jsonText = completion.choices[0]?.message?.content?.trim() || ''
  if (!jsonText) {
    throw new Error('DeepSeek API 返回为空')
  }
  return { jsonText, cost }
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      throw new DeepSeekAuthError()
    }
    if (error?.status === 429 || error?.message?.includes('rate_limit')) {
      throw new DeepSeekRateLimitError()
    }
    throw error
  }
}
