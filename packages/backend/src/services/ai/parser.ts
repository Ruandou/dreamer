import type { ModelCallLogContext } from './api-logger.js'
import { type DeepSeekCost } from './deepseek-client.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai.constants.js'
import {
  type ParsedCharacter,
  type ParsedCharacterImage,
  normalizeParsedCharacterList
} from './parsed-script-types.js'
import { callLLMWithRetry, parseJsonResponse, type LLMCallOptions } from './llm-call-wrapper.js'
import { getDefaultProvider } from './llm-factory.js'

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
    script: unknown
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
  const provider = getDefaultProvider()

  // Parser function for the wrapper
  const parseResponse = (response: string): ParsedScript => {
    // 使用带自动修复的 JSON 解析
    const parsed = parseJsonResponse(response)
    return normalizeParsedData(parsed)
  }

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: PARSER_SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ],
    temperature: DEEPSEEK_TEMPERATURE.PARSER,
    maxTokens: DEEPSEEK_MAX_TOKENS.PARSER,
    modelLog: log
  }

  const result = await callLLMWithRetry(callOptions, parseResponse)

  return {
    parsed: result.content,
    cost: result.cost
  }
}

/** Raw shape from LLM JSON (before normalization) */
interface RawCharacterImage {
  name?: unknown
  type?: unknown
  description?: unknown
}
interface RawCharacter {
  name?: unknown
  description?: unknown
  aliases?: unknown
  images?: unknown
}
interface RawEpisodeScene {
  sceneNum?: unknown
  num?: unknown
  location?: unknown
  timeOfDay?: unknown
  time?: unknown
  characters?: unknown
  description?: unknown
  content?: unknown
  text?: unknown
  dialogues?: unknown
  actions?: unknown
  prompt?: unknown
}
interface RawEpisode {
  episodeNum?: unknown
  number?: unknown
  num?: unknown
  title?: unknown
  name?: unknown
  summary?: unknown
  description?: unknown
  scenes?: unknown
  chapters?: unknown
  content?: unknown
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function normalizeParsedData(raw: unknown): ParsedScript {
  const d = raw as Record<string, unknown>

  // Normalize characters - handle both old format ["角色1", "角色2"] and new format [{name, description, images}]
  const rawChars = (d.characters ?? []) as unknown[]
  const characters: ParsedCharacter[] = rawChars.map((c) => {
    if (typeof c === 'string') return { name: c, description: '' }
    const ch = c as RawCharacter
    const images: ParsedCharacterImage[] | undefined = Array.isArray(ch.images)
      ? (ch.images as RawCharacterImage[]).map((img) => ({
          name: toStr(img?.name).trim() || '基础形象',
          type: toStr(img?.type).toLowerCase(),
          description: toStr(img?.description).trim()
        }))
      : undefined
    const aliases: string[] | undefined = Array.isArray(ch.aliases)
      ? (ch.aliases as unknown[]).map((a) => toStr(a).trim()).filter(Boolean)
      : undefined
    return {
      name: toStr(ch.name),
      description: toStr(ch.description),
      aliases,
      images
    }
  })

  const result: ParsedScript = {
    projectName: toStr(d.projectName ?? d.name ?? '未命名项目'),
    description: toStr(d.description),
    characters: normalizeParsedCharacterList(characters),
    episodes: []
  }

  const episodes = (d.episodes ?? d.chapters ?? d.scripts ?? []) as RawEpisode[]

  for (const ep of episodes) {
    const sceneList: ParsedScript['episodes'][0]['scenes'] = []
    const epScenes = (ep.scenes ?? ep.chapters ?? ep.content ?? []) as RawEpisodeScene[]

    for (const sc of epScenes) {
      sceneList.push({
        sceneNum: (sc.sceneNum ?? sc.num ?? 1) as number,
        description: toStr(sc.description ?? sc.content ?? sc.text),
        prompt: toStr(sc.prompt) || buildPromptFromScene(sc)
      })
    }

    const epNum = (ep.episodeNum ?? ep.number ?? ep.num ?? 1) as number
    result.episodes.push({
      episodeNum: epNum,
      title: toStr(ep.title ?? ep.name ?? `第${epNum}集`),
      script: {
        title: toStr(ep.title ?? ep.name),
        summary: toStr(ep.summary ?? ep.description),
        scenes: epScenes.map((s) => ({
          sceneNum: (s.sceneNum ?? 1) as number,
          location: toStr(s.location),
          timeOfDay: toStr(s.timeOfDay ?? s.time ?? '日'),
          characters: (Array.isArray(s.characters) ? s.characters : []) as string[],
          description: toStr(s.description ?? s.content),
          dialogues: (Array.isArray(s.dialogues) ? s.dialogues : []) as unknown[],
          actions: (Array.isArray(s.actions) ? s.actions : []) as string[]
        }))
      },
      scenes: sceneList
    })
  }

  result.episodes.sort((a, b) => a.episodeNum - b.episodeNum)
  return result
}

function buildPromptFromScene(scene: RawEpisodeScene): string {
  const parts: string[] = []

  const loc = toStr(scene.location)
  const tod = toStr(scene.timeOfDay)
  const desc = toStr(scene.description)
  if (loc) parts.push(loc)
  if (tod) parts.push(tod)
  if (desc) parts.push(desc)
  if (scene.actions) {
    if (Array.isArray(scene.actions)) {
      parts.push(...(scene.actions as string[]))
    } else if (typeof scene.actions === 'string') {
      parts.push(scene.actions)
    }
  }
  if (scene.dialogues) {
    const dialogues = Array.isArray(scene.dialogues)
      ? scene.dialogues
      : Object.entries(scene.dialogues as Record<string, unknown>).map(([c, d]) => `${c}: ${d}`)
    parts.push((dialogues as string[]).join(' '))
  }

  return parts.filter(Boolean).join(', ')
}
