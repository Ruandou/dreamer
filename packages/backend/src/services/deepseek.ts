import OpenAI from 'openai'
import type { ScriptContent, ScriptScene, Dialogue } from '@shared/types'

// DeepSeek pricing (per 1M tokens)
const DEEPSEEK_INPUT_COST_PER_1M = 0.27  // USD
const DEEPSEEK_OUTPUT_COST_PER_1M = 1.07  // USD

export interface DeepSeekCost {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUSD: number
  costCNY: number
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

export function calculateDeepSeekCost(usage: any): DeepSeekCost {
  const inputTokens = usage?.prompt_tokens || 0
  const outputTokens = usage?.completion_tokens || 0
  const totalTokens = usage?.total_tokens || 0

  const costUSD = (inputTokens / 1_000_000) * DEEPSEEK_INPUT_COST_PER_1M +
                  (outputTokens / 1_000_000) * DEEPSEEK_OUTPUT_COST_PER_1M

  // CNY exchange rate approximation
  const CNY_RATE = 7.2
  const costCNY = costUSD * CNY_RATE

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUSD,
    costCNY
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
    let dialogues: Dialogue[] = []
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
