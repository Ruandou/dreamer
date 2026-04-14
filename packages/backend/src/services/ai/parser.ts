import type { ModelCallLogContext } from './api-logger.js'
import { logDeepSeekChat } from './model-call-log.js'
import {
  calculateDeepSeekCost,
  getDeepSeekClient,
  DeepSeekAuthError,
  DeepSeekRateLimitError,
  type DeepSeekCost
} from './deepseek-client.js'

export { DeepSeekAuthError, DeepSeekRateLimitError }

/** 与 DeepSeek 计价结构一致（解析路径默认未计缓存命中） */
export type ParsedScriptCost = DeepSeekCost

export interface ParsedCharacter {
  name: string
  description: string  // 角色外貌、年龄、性格等描述
}

export interface ParsedScript {
  projectName?: string
  description?: string
  characters: ParsedCharacter[]  // 改为对象数组，包含描述
  episodes: {
    episodeNum: number
    title: string
    script: any
    scenes: {
      sceneNum: number
      description: string
      prompt: string
    }[]
  }[]
}

const PARSER_SYSTEM_PROMPT = `你是一个专业的短剧剧本结构化解析器。
给定一个剧本改造方案的Markdown文档，你需要提取并结构化其中的信息。

请严格按以下JSON格式返回：
{
  "projectName": "项目名称（如：天工开物）",
  "description": "项目简介",
  "characters": [
    {
      "name": "角色1",
      "description": "角色的外貌特征描述：年龄、发型、穿着、表情特点等，用于AI生成角色形象"
    },
    {
      "name": "角色2",
      "description": "角色的外貌特征描述..."
    }
  ],
  "episodes": [
    {
      "episodeNum": 1,
      "title": "第1集标题",
      "scenes": [
        {
          "sceneNum": 1,
          "description": "场景描述（包含地点、时间、动作、对白等）",
          "prompt": "视频生成提示词"
        }
      ]
    }
  ]
}

注意事项：
1. 仔细分析剧本中每个角色的外貌特征描述（外貌、年龄、服装、表情等）
2. 如果剧本中没有明确描述外貌，根据角色名称和性格合理推断外貌特征
3. characters数组中的description要尽量详细，描述可以用于AI绘图生成角色形象
4. 每集的场景要完整提取
5. prompt要从场景描述中提取关键视觉元素
4. 如果原文档包含详细分镜（如有镜号、景别等），优先保留完整信息
5. 如果文档是剧情纲要格式（如“第1集：标题 - 剧情概述”），也要正确解析
6. 只返回JSON，不要包含任何其他文字`

export async function parseScriptDocument(
  content: string,
  type: 'markdown' | 'json',
  log?: ModelCallLogContext
): Promise<{ parsed: ParsedScript; cost: ParsedScriptCost | null }> {
  // 如果是 JSON 格式，直接解析
  if (type === 'json') {
    try {
      const parsed = JSON.parse(content)
      return { parsed: normalizeParsedData(parsed), cost: null }
    } catch {
      throw new Error('JSON 格式解析失败')
    }
  }

  // Markdown 格式，调用 AI 解析
  const userMessage = `请解析以下剧本文档：\n\n${content}`
  const deepseek = getDeepSeekClient()
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: PARSER_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 8000
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('AI 解析返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage, false)

      // 清理返回内容
      let cleanContent = response
      if (response.includes('```json')) {
        cleanContent = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }

      const parsed = JSON.parse(cleanContent)
      await logDeepSeekChat(log, userMessage, {
        status: 'completed',
        costCNY: cost.costCNY
      })
      return { parsed: normalizeParsedData(parsed), cost }
    } catch (error: any) {
      lastError = error

      if (error?.status === 401 || error?.status === 403) {
        await logDeepSeekChat(log, userMessage, {
          status: 'failed',
          errorMsg: error?.message || 'DeepSeek auth error'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === 429 || error?.message?.includes('rate_limit')) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
          continue
        }
        await logDeepSeekChat(log, userMessage, {
          status: 'failed',
          errorMsg: 'rate_limit'
        })
        throw new DeepSeekRateLimitError()
      }

      // For parsing errors, don't retry
      if (error.message === '剧本解析失败，请检查文档格式' || error.message === 'AI 解析返回为空') {
        await logDeepSeekChat(log, userMessage, {
          status: 'failed',
          errorMsg: String(error?.message || 'parse')
        })
        throw error
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  console.error('Failed to parse AI response after retries')
  await logDeepSeekChat(log, userMessage, {
    status: 'failed',
    errorMsg: lastError?.message || '剧本解析失败'
  })
  throw lastError || new Error('剧本解析失败，请检查文档格式')
}

function normalizeParsedData(data: any): ParsedScript {
  // Normalize characters - handle both old format ["角色1", "角色2"] and new format [{name, description}]
  let characters: ParsedCharacter[] = []
  if (Array.isArray(data.characters)) {
    characters = data.characters.map((c: any) => {
      if (typeof c === 'string') {
        return { name: c, description: '' }
      }
      return { name: c.name || '', description: c.description || '' }
    })
  }

  const result: ParsedScript = {
    projectName: data.projectName || data.name || '未命名项目',
    description: data.description || '',
    characters,
    episodes: []
  }

  const episodes = data.episodes || data.chapters || data.scripts || []
  
  for (const ep of episodes) {
    const scenes: ParsedScript['episodes'][0]['scenes'] = []
    
    const epScenes = ep.scenes || ep.chapters || ep.content || []
    for (const scene of epScenes) {
      scenes.push({
        sceneNum: scene.sceneNum || scene.num || 1,
        description: scene.description || scene.content || scene.text || '',
        prompt: scene.prompt || buildPromptFromScene(scene)
      })
    }

    result.episodes.push({
      episodeNum: ep.episodeNum || ep.number || ep.num || 1,
      title: ep.title || ep.name || `第${ep.episodeNum || 1}集`,
      script: {
        title: ep.title || ep.name,
        summary: ep.summary || ep.description || '',
        scenes: epScenes.map((s: any) => ({
          sceneNum: s.sceneNum || 1,
          location: s.location || '',
          timeOfDay: s.timeOfDay || s.time || '日',
          characters: s.characters || [],
          description: s.description || s.content || '',
          dialogues: s.dialogues || [],
          actions: s.actions || []
        }))
      },
      scenes
    })
  }

  // 按集数排序
  result.episodes.sort((a, b) => a.episodeNum - b.episodeNum)

  return result
}

function buildPromptFromScene(scene: any): string {
  const parts: string[] = []

  if (scene.location) parts.push(scene.location)
  if (scene.timeOfDay) parts.push(scene.timeOfDay)
  if (scene.description) parts.push(scene.description)
  if (scene.actions) {
    if (Array.isArray(scene.actions)) {
      parts.push(...scene.actions)
    } else if (typeof scene.actions === 'string') {
      parts.push(scene.actions)
    }
  }
  if (scene.dialogues) {
    const dialogues = Array.isArray(scene.dialogues)
      ? scene.dialogues
      : Object.entries(scene.dialogues || {}).map(([c, d]) => `${c}: ${d}`)
    parts.push(dialogues.join(' '))
  }

  return parts.filter(Boolean).join(', ')
}