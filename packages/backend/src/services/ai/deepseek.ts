import OpenAI from 'openai'
import type { ScriptContent, ScriptScene, ScriptDialogueLine } from '@dreamer/shared/types'
import type { ModelCallLogContext } from '../api-logger.js'
import { logDeepSeekChat } from '../model-call-log.js'

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

export async function expandScript(
  summary: string,
  projectContext?: string,
  log?: ModelCallLogContext
): Promise<{ script: ScriptContent; cost: DeepSeekCost }> {
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

      await logDeepSeekChat(log, userPrompt, { status: 'completed', costCNY: cost.costCNY })
      return { script, cost }
    } catch (error: any) {
      lastError = error

      // Handle specific errors
      if (error?.status === 401 || error?.status === 403) {
        await logDeepSeekChat(log, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
          continue
        }
        await logDeepSeekChat(log, userPrompt, { status: 'failed', errorMsg: 'rate_limit' })
        throw new DeepSeekRateLimitError()
      }

      // For content parsing errors, don't retry
      if (error.message === '剧本格式不正确' || error.message === 'DeepSeek API 返回为空') {
        await logDeepSeekChat(log, userPrompt, {
          status: 'failed',
          errorMsg: error.message
        })
        throw error
      }

      // Other errors, retry once
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  await logDeepSeekChat(log, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '剧本生成失败'
  })
  throw lastError || new Error('剧本生成失败')
}

export async function optimizePrompt(
  prompt: string,
  context?: string,
  log?: ModelCallLogContext
): Promise<{ optimized: string; cost: DeepSeekCost }> {
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

      await logDeepSeekChat(log, userPrompt, { status: 'completed', costCNY: cost.costCNY })
      return { optimized, cost }
    } catch (error: any) {
      lastError = error

      if (error?.status === 401 || error?.status === 403) {
        await logDeepSeekChat(log, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
          continue
        }
        await logDeepSeekChat(log, userPrompt, { status: 'failed', errorMsg: 'rate_limit' })
        throw new DeepSeekRateLimitError()
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  await logDeepSeekChat(log, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '提示词优化失败'
  })
  throw lastError || new Error('提示词优化失败')
}

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
  log?: ModelCallLogContext
): Promise<{ prompt: string; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  const extra = characterSlotExtraInstructions(input.slotType)
  const user = [
    `角色名：${input.characterName}`,
    input.characterDescription ? `角色设定：${input.characterDescription}` : '',
    `形象槽位名称：${input.slotName}`,
    `槽位类型：${input.slotType}（base 为基础定妆，outfit 为换装需与基础形象一致的人物特征）`,
    input.slotDescription ? `槽位说明：${input.slotDescription}` : '',
    input.parentSlotSummary ? `父级基础形象参考：${input.parentSlotSummary}` : '',
    '',
    ...extra,
    '',
    '请输出一条中文的 AI 绘画提示词（写实或半写实风格、短剧角色定妆），只输出提示词正文，不要引号或解释。'
  ]
    .filter(Boolean)
    .join('\n')

  try {
  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: characterSlotSystemPrompt(input.slotType)
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
  await logDeepSeekChat(log, user, { status: 'completed', costCNY: cost.costCNY })
  return { prompt, cost }
  } catch (error: any) {
    await logDeepSeekChat(log, user, {
      status: 'failed',
      errorMsg: error?.message || 'character_slot_prompt'
    })
    if (error?.status === 401 || error?.status === 403) {
      throw new DeepSeekAuthError()
    }
    if (error?.status === 429 || error?.message?.includes('rate_limit')) {
      throw new DeepSeekRateLimitError()
    }
    throw error
  }
}

/** system 过长时模型容易输出非严格 JSON，长规则放在用户消息中 */
export const SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT = [
  '你只输出紧凑的合法 JSON，供中文短剧生产工具使用；不要 markdown、不要前言/后语。',
  'locations 与 characters 的撰写细则在用户消息中；locations[].imagePrompt 与 characters[].images[].prompt 须为中文。',
  '必须返回一个 JSON 对象，且包含 locations 与 characters 两个键；字段不得遗漏。若无场地则 locations 为 []。',
  '若下列用户消息提供了场地列表：locations 须覆盖每个场地名，且每条 name 必须与列表第一列场地名称完全一致（逐字相同，勿改写或缩写）。'
].join('\n')

/** 写入用户消息，与 buildScriptVisualEnrichmentUserContent 同步 */
export const SCRIPT_VISUAL_ENRICH_LOCATION_RULES_IN_USER = [
  '【定场图 imagePrompt】（仅用于 locations 数组；不影响 characters）',
  '视角：你是顶级电影勘景摄影师，每条 imagePrompt 描述的是空无一人的拍摄场景，作为文生图指令，不是剧本片段。',
  '铁律：绝对禁止在 imagePrompt 中出现任何人物、动物、影子或任何暗示人类活动的痕迹；若场地描述中含人物动作，你必须过滤掉。',
  '每条 imagePrompt 须为中文，四段意合为一段连续文字、句间用句号分隔，整体不超过约120字：',
  '1）空间与环境：核心建筑结构、标志性物体、材质与布局；',
  '2）光影与氛围：依「时间」写光线方向、硬/柔与色温、情绪氛围；时间未指定时可依描述推断或使用中性光；',
  '3）构图与视角：推荐景别与角度（如广角全景、平视中景）；',
  '4）风格与画质：融入下方「项目视觉风格」；并含画质词（如电影质感、8K超高清等）。',
  '【文生图合规】商业化文生图 API 常对「审讯室」「刑讯」「看守所」「监狱」「羁押」等执法/刑事监禁类字面触发审核或拒图。若剧本为警务、刑侦场景，定场图只写建筑与光影：双面玻璃隔间、会谈室、办公问询区、玻璃对侧空房间、冷色涂料墙面、监控室外观等中性置景词；避免刑讯、关押、暴力执法暗示；不写人物与剧情动作。',
  'characters 的定妆规则以本消息下文为准；勿用定场图的「无人」约束去改写角色定妆。'
].join('\n')

export function buildScriptVisualEnrichmentUserContent(input: {
  scriptSummary: string
  locationLines: string
  characterLines: string
  projectVisualStyleLine: string
  /** 与库内 Location.name 完全一致的可复制列表，减少模型改写场地名导致无法落库 */
  exactLocationNames?: string[]
}): string {
  const style = input.projectVisualStyleLine.trim() || '（未指定）'
  const names = input.exactLocationNames?.filter(Boolean) ?? []
  const locationNameBlock =
    names.length > 0
      ? [
          '【场地名白名单】locations[].name 必须逐字等于下列某一行（整行复制到 JSON 的 name 字段；勿改写、勿缩写、勿加「场景」「内景」等前缀；括号与标点须保留）：',
          ...names.map((n) => `- ${n.replace(/\s+/g, ' ').trim()}`),
          ''
        ]
      : []
  return [
    '根据下列剧本梗概与实体列表，输出 **仅一段合法 JSON**（不要 markdown 代码块），结构为：',
    '{"locations":[{"name":"场地名","imagePrompt":"中文定场图提示词"}],',
    '"characters":[{"name":"角色名","images":[{"name":"形象名","type":"base|outfit|expression|pose","description":"可选中文说明","prompt":"中文提示词"}]}]}',
    '',
    SCRIPT_VISUAL_ENRICH_LOCATION_RULES_IN_USER,
    '',
    ...locationNameBlock,
    '【项目视觉风格】用于 locations 每条 imagePrompt 的第4段（风格与画质），须自然融入：',
    style,
    '',
    'locations 中每条 imagePrompt 须符合上文「定场图」四段式；locations 每条 name 必须使用上文白名单（若有）或下文场地列表第一列名称；整段响应仍为唯一 JSON 对象。',
    '',
    '规则（角色 images 数组顺序很重要）：',
    '1. 每个角色的 images 里 **必须先写至少 1 条 type 为 base 的定妆**（可与默认基础形象对应），再写衍生。',
    '2. **base**：prompt 为完整中文定妆提示词（主参考图）。须：站立于**纯色影棚背景**（如中灰色）；**七分身构图（膝盖以上）**；四段意合为一段、句间用句号分隔，整体不超过约120字：（1）主体与外貌（2）发型与标志（3）服装与姿态（4）构图与背景须显式包含七分身与纯色底，并融入下方「项目视觉风格」与画质词；禁止只写剧情动作，须写「长什么样、穿什么」。',
    '3. **outfit**（换装）：优先采用「保持该角色面部特征、发型与所有标志性细节完全不变，仅将服装更换为：……。纯色影棚背景。」整体不超过约100字；须写清相对 base 仅变化服装与配饰。',
    '4. **expression / pose**（表情/姿态）：相对 base 明确保持不变与仅变化；建议先锁身份（与 base 同一人）再写表情或体态的差异，避免写成全新人物。',
    '5. 衍生推荐句式：与基础定妆为同一人；保持……不变；仅变化：……。若输出缺显式锚定，服务端可能在落库时补前缀，模型仍应优先输出完整句。',
    '6. 有换装、明显表情或姿态差异时再追加衍生条目；无则不必凑数。',
    'locations 数组覆盖下列场地名；characters 覆盖下列角色名。',
    '',
    `剧本梗概：\n${input.scriptSummary.slice(0, 8000)}`,
    '',
    `场地（每行：名称 | 时间：… | 描述：…）：\n${input.locationLines || '(无)'}`,
    '',
    `角色（每行：名称 | 已有描述）：\n${input.characterLines || '(无)'}`
  ].join('\n')
}

export async function fetchScriptVisualEnrichmentJson(
  input: {
    scriptSummary: string
    locationLines: string
    characterLines: string
    /** 项目视觉风格（顿号连接），供定场图第4段融入 */
    projectVisualStyleLine?: string
    /** 当前项目场地库名称，供白名单约束，降低模型改写名导致 imagePrompt 不落库 */
    exactLocationNames?: string[]
  },
  log?: ModelCallLogContext
): Promise<{ jsonText: string; cost: DeepSeekCost }> {
  const projectVisualStyleLine = (input.projectVisualStyleLine || '').trim() || '（未指定）'
  /** 构建 user、client、请求、落库 全在同一段 try，避免中途抛错时未写入 ModelApiCall */
  let user = ''
  try {
    user = buildScriptVisualEnrichmentUserContent({ ...input, projectVisualStyleLine })
    const deepseek = getDeepSeekClient()
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT
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
    await logDeepSeekChat(log, user, { status: 'completed', costCNY: cost.costCNY }, {
      systemMessage: SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT
    })
    return { jsonText, cost }
  } catch (error: any) {
    await logDeepSeekChat(
      log,
      user || '（未能生成 user 提示词，可能在 buildScriptVisualEnrichmentUserContent 阶段失败）',
      {
        status: 'failed',
        errorMsg: error?.message || 'visual_enrichment'
      },
      { systemMessage: SCRIPT_VISUAL_ENRICH_SYSTEM_PROMPT }
    )
    if (error?.status === 401 || error?.status === 403) {
      throw new DeepSeekAuthError()
    }
    if (error?.status === 429 || error?.message?.includes('rate_limit')) {
      throw new DeepSeekRateLimitError()
    }
    throw error
  }
}
