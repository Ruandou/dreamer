import OpenAI from 'openai'

// DeepSeek pricing (per 1M tokens)
const DEEPSEEK_INPUT_COST_PER_1M = 0.27  // USD
const DEEPSEEK_OUTPUT_COST_PER_1M = 1.07  // USD
const CNY_RATE = 7.2

export interface ParsedScriptCost {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUSD: number
  costCNY: number
}

function calculateCost(usage: any): ParsedScriptCost {
  const inputTokens = usage?.prompt_tokens || 0
  const outputTokens = usage?.completion_tokens || 0
  const totalTokens = usage?.total_tokens || 0

  const costUSD = (inputTokens / 1_000_000) * DEEPSEEK_INPUT_COST_PER_1M +
                  (outputTokens / 1_000_000) * DEEPSEEK_OUTPUT_COST_PER_1M

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUSD,
    costCNY: costUSD * CNY_RATE
  }
}

function getDeepSeekClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
  })
}

export interface ParsedScript {
  projectName?: string
  description?: string
  characters: string[]
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
  "characters": ["角色1", "角色2", ...],
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
1. 提取所有出现的角色名称
2. 每集的场景要完整提取
3. prompt要从场景描述中提取关键视觉元素
4. 如果原文档包含详细分镜（如有镜号、景别等），优先保留完整信息
5. 如果文档是剧情纲要格式（如“第1集：标题 - 剧情概述”），也要正确解析
6. 只返回JSON，不要包含任何其他文字`

export async function parseScriptDocument(
  content: string,
  type: 'markdown' | 'json'
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
  const deepseek = getDeepSeekClient()

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: PARSER_SYSTEM_PROMPT },
      { role: 'user', content: `请解析以下剧本文档：\n\n${content}` }
    ],
    temperature: 0.3,
    max_tokens: 8000
  })

  const response = completion.choices[0]?.message?.content
  if (!response) {
    throw new Error('AI 解析返回为空')
  }

  const cost = calculateCost(completion.usage)

  try {
    // 清理返回内容
    let cleanContent = response
    if (response.includes('```json')) {
      cleanContent = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    const parsed = JSON.parse(cleanContent)
    return { parsed: normalizeParsedData(parsed), cost }
  } catch (error) {
    console.error('Failed to parse AI response:', response)
    throw new Error('剧本解析失败，请检查文档格式')
  }
}

function normalizeParsedData(data: any): ParsedScript {
  const result: ParsedScript = {
    projectName: data.projectName || data.name || '未命名项目',
    description: data.description || '',
    characters: Array.isArray(data.characters) ? data.characters : [],
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