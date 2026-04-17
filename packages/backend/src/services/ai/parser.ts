import type { ModelCallLogContext } from './api-logger.js'
import { getDeepSeekClient, type DeepSeekCost } from './deepseek-client.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai.constants.js'
import {
  type ParsedCharacter,
  type ParsedCharacterImage,
  normalizeParsedCharacterList
} from './parsed-script-types.js'
import {
  callDeepSeekWithRetry,
  cleanMarkdownCodeBlocks,
  type DeepSeekCallOptions
} from './deepseek-call-wrapper.js'

export type { ParsedCharacter }
export { DeepSeekAuthError, DeepSeekRateLimitError } from './deepseek-client.js'

/** 与 DeepSeek 计价结构一致（解析路径默认未计缓存命中） */
export type ParsedScriptCost = DeepSeekCost

export interface ParsedScript {
  projectName?: string
  description?: string
  characters: ParsedCharacter[]
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

# 角色提取规则（重要）
1. **识别独特个体**：每个真实人物只创建一个角色记录，无论剧本中有多少种称呼或身份（如「宋应星」「宋大人」「宋工部尚书」应为同一人，角色名用剧本中最稳定的全名或主名，如「宋应星」）。
2. **识别身份/服装变化**：分析该角色在剧中出现的官职、称呼、服装差异，映射为 images 槽位，不要为同一人的不同称呼各建一条角色。
3. **images 数组**：每个角色必须至少有一条 type 为 "base" 的基础形象；每种明显服装/身份变化增加一条 type 为 "outfit" 的槽位，并在 description 中写清该装扮特征。

请严格按以下JSON格式返回：
{
  "projectName": "项目名称（如：天工开物）",
  "description": "项目简介",
  "characters": [
    {
      "name": "角色规范名",
      "description": "角色整体人设：年龄、性格、外貌共性等",
      "aliases": ["剧中曾出现的其他称谓，可选"],
      "images": [
        {
          "name": "基础形象",
          "type": "base",
          "description": "日常或最常见装扮的具象外貌与服装描述，用于定妆"
        },
        {
          "name": "某身份装扮",
          "type": "outfit",
          "description": "该套服装或身份下的外貌与服饰细节"
        }
      ]
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
1. characters[].description 与 images[].description 要尽量详细，便于后续 AI 绘图。
2. 每集的场景要完整提取；prompt 从场景描述中提取关键视觉元素。
3. 若原文档包含详细分镜（镜号、景别等），优先保留完整信息。
4. 若文档是剧情纲要格式（如「第1集：标题 - 剧情概述」），也要正确解析。
5. 只返回 JSON，不要包含任何其他文字。`

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

  // Parser function for the wrapper
  const parseResponse = (response: string): ParsedScript => {
    // 清理返回内容
    const cleanContent = cleanMarkdownCodeBlocks(response)
    const parsed = JSON.parse(cleanContent)
    return normalizeParsedData(parsed)
  }

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: PARSER_SYSTEM_PROMPT,
    userPrompt: userMessage,
    temperature: DEEPSEEK_TEMPERATURE.PARSER,
    maxTokens: DEEPSEEK_MAX_TOKENS.PARSER,
    modelLog: log
  }

  const result = await callDeepSeekWithRetry(options, parseResponse)

  return {
    parsed: result.content,
    cost: result.cost
  }
}

function normalizeParsedData(data: any): ParsedScript {
  // Normalize characters - handle both old format ["角色1", "角色2"] and new format [{name, description, images}]
  let characters: ParsedCharacter[] = []
  if (Array.isArray(data.characters)) {
    characters = data.characters.map((c: any) => {
      if (typeof c === 'string') {
        return { name: c, description: '' }
      }
      const images: ParsedCharacterImage[] | undefined = Array.isArray(c.images)
        ? c.images.map((img: any) => ({
            name: String(img?.name || '').trim() || '基础形象',
            type: String(img?.type || 'base').toLowerCase(),
            description: String(img?.description || '').trim()
          }))
        : undefined
      const aliases: string[] | undefined = Array.isArray(c.aliases)
        ? c.aliases.map((a: any) => String(a).trim()).filter(Boolean)
        : undefined
      return {
        name: c.name || '',
        description: c.description || '',
        aliases,
        images
      }
    })
    characters = normalizeParsedCharacterList(characters)
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
