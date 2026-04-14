import type { ScriptContent, ScriptScene, ScriptDialogueLine } from '@dreamer/shared/types'
import type { ModelCallLogContext } from './api-logger.js'
import { logDeepSeekChat } from './model-call-log.js'
import {
  calculateDeepSeekCost,
  getDeepSeekClient,
  DeepSeekAuthError,
  DeepSeekRateLimitError,
  type DeepSeekCost
} from './deepseek-client.js'

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
