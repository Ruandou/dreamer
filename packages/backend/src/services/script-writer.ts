import OpenAI from 'openai'
import type { ScriptContent, ScriptScene, ScriptDialogueLine, Character } from '@dreamer/shared/types'
import { calculateDeepSeekCost, type DeepSeekCost, DeepSeekAuthError, DeepSeekRateLimitError } from './ai/deepseek.js'
import type { ModelCallLogContext } from './ai/api-logger.js'
import { logDeepSeekChat } from './ai/model-call-log.js'
import {
  DEEPSEEK_TEMPERATURE,
  DEEPSEEK_MAX_TOKENS,
  DEFAULT_RETRY_ATTEMPTS,
  AUTH_RETRY_DELAY_MS,
  RETRY_BASE_DELAY_MS,
  AUTH_ERROR_STATUS_CODES,
  RATE_LIMIT_STATUS_CODE
} from './ai/ai.constants.js'
import { SCRIPT_WRITER_PROMPT, EPISODE_WRITER_PROMPT } from './prompts/script-prompts.js'

export interface ScriptWriterOptions {
  characters?: Character[]
  projectContext?: string
  /** 模型调用审计（DeepSeek chat） */
  modelLog?: ModelCallLogContext
}

export interface ScriptWriterResult {
  script: ScriptContent
  cost: DeepSeekCost
}

/**
 * 从一句话想法生成专业剧本
 */
export async function writeScriptFromIdea(
  idea: string,
  options?: ScriptWriterOptions
): Promise<ScriptWriterResult> {
  const deepseek = getDeepSeekClient()

  const userPrompt = buildUserPrompt(idea, options)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SCRIPT_WRITER_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: DEEPSEEK_TEMPERATURE.SCRIPT_WRITING,
        max_tokens: DEEPSEEK_MAX_TOKENS.SCRIPT_WRITING
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)
      const script = parseScriptResponse(content)

      validateScript(script)

      await logDeepSeekChat(options?.modelLog, userPrompt, {
        status: 'completed',
        costCNY: cost.costCNY
      })
      return { script, cost }
    } catch (error: any) {
      lastError = error

      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        await logDeepSeekChat(options?.modelLog, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          await sleep(AUTH_RETRY_DELAY_MS * attempt)
          continue
        }
        await logDeepSeekChat(options?.modelLog, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit'
        })
        throw new DeepSeekRateLimitError()
      }

      if (attempt < DEFAULT_RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS)
        continue
      }
    }
  }

  await logDeepSeekChat(options?.modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '剧本生成失败'
  })
  throw lastError || new Error('剧本生成失败')
}

/**
 * 根据全剧梗概与前情续写某一集（用于批量生成第 2 集及以后）
 */
export async function writeEpisodeForProject(
  episodeNum: number,
  seriesSynopsis: string,
  rollingContext: string,
  seriesTitle: string,
  modelLog?: ModelCallLogContext
): Promise<ScriptWriterResult> {
  const deepseek = getDeepSeekClient()
  const userPrompt = `剧名：${seriesTitle}
全剧梗概：${seriesSynopsis}
前情与已发生剧情摘要：${rollingContext || '（首集后的连续剧情）'}

请只写第 ${episodeNum} 集的剧本 JSON。`

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: EPISODE_WRITER_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: DEEPSEEK_TEMPERATURE.SCRIPT_IMPROVEMENT,
        max_tokens: DEEPSEEK_MAX_TOKENS.SCRIPT_IMPROVEMENT
      })
      const content = completion.choices[0]?.message?.content
      if (!content) throw new Error('DeepSeek API 返回为空')
      const cost = calculateDeepSeekCost(completion.usage)
      const script = parseScriptResponse(content)
      validateScript(script)
      await logDeepSeekChat(modelLog, userPrompt, { status: 'completed', costCNY: cost.costCNY })
      return { script, cost }
    } catch (error: any) {
      lastError = error
      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        await logDeepSeekChat(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }
      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          await sleep(AUTH_RETRY_DELAY_MS * attempt)
          continue
        }
        await logDeepSeekChat(modelLog, userPrompt, { status: 'failed', errorMsg: 'rate_limit' })
        throw new DeepSeekRateLimitError()
      }
      if (attempt < DEFAULT_RETRY_ATTEMPTS) await sleep(RETRY_BASE_DELAY_MS)
    }
  }
  await logDeepSeekChat(modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || `第 ${episodeNum} 集剧本生成失败`
  })
  throw lastError || new Error(`第 ${episodeNum} 集剧本生成失败`)
}

/**
 * 扩展剧本（生成更多场景）
 */
export async function expandScript(
  script: ScriptContent,
  additionalScenes: number = 3,
  options?: ScriptWriterOptions
): Promise<ScriptWriterResult> {
  const deepseek = getDeepSeekClient()

  const userPrompt = `请为以下剧本扩展${additionalScenes}个新场景：

当前剧本：
${JSON.stringify(script, null, 2)}

请保持：
1. 相同的风格和基调
2. 角色一致性
3. 故事连贯性

新增场景应该推动剧情发展，增加冲突或揭示新信息。

直接返回JSON格式的完整剧本（包括原有场景+新场景）。`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SCRIPT_WRITER_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: DEEPSEEK_TEMPERATURE.SCRIPT_WRITING,
        max_tokens: DEEPSEEK_MAX_TOKENS.SCRIPT_WRITING
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)
      const script = parseScriptResponse(content)

      validateScript(script)

      await logDeepSeekChat(options?.modelLog, userPrompt, {
        status: 'completed',
        costCNY: cost.costCNY
      })
      return { script, cost }
    } catch (error: any) {
      lastError = error

      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        await logDeepSeekChat(options?.modelLog, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          await sleep(AUTH_RETRY_DELAY_MS * attempt)
          continue
        }
        await logDeepSeekChat(options?.modelLog, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit'
        })
        throw new DeepSeekRateLimitError()
      }

      if (attempt < DEFAULT_RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS)
        continue
      }
    }
  }

  await logDeepSeekChat(options?.modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '剧本扩展失败'
  })
  throw lastError || new Error('剧本扩展失败')
}

/**
 * 改进剧本
 */
export async function improveScript(
  script: ScriptContent,
  feedback: string,
  options?: ScriptWriterOptions
): Promise<ScriptWriterResult> {
  const deepseek = getDeepSeekClient()

  const userPrompt = `请根据以下反馈改进剧本：

当前剧本：
${JSON.stringify(script, null, 2)}

用户反馈：
${feedback}

请保持剧本的整体结构，只根据反馈进行针对性改进。

直接返回JSON格式的完整剧本。`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SCRIPT_WRITER_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: DEEPSEEK_TEMPERATURE.SCRIPT_WRITING,
        max_tokens: DEEPSEEK_MAX_TOKENS.SCRIPT_WRITING
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)
      const improvedScript = parseScriptResponse(content)

      validateScript(improvedScript)

      await logDeepSeekChat(options?.modelLog, userPrompt, {
        status: 'completed',
        costCNY: cost.costCNY
      })
      return { script: improvedScript, cost }
    } catch (error: any) {
      lastError = error

      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        await logDeepSeekChat(options?.modelLog, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          await sleep(AUTH_RETRY_DELAY_MS * attempt)
          continue
        }
        await logDeepSeekChat(options?.modelLog, userPrompt, {
          status: 'failed',
          errorMsg: 'rate_limit'
        })
        throw new DeepSeekRateLimitError()
      }

      if (attempt < DEFAULT_RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS)
        continue
      }
    }
  }

  await logDeepSeekChat(options?.modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '剧本改进失败'
  })
  throw lastError || new Error('剧本改进失败')
}

/**
 * 优化单个场景描述
 */
export async function optimizeSceneDescription(
  description: string,
  sceneContext?: {
    location?: string
    timeOfDay?: string
    characters?: string[]
  },
  modelLog?: ModelCallLogContext
): Promise<string> {
  const deepseek = getDeepSeekClient()

  const contextStr = sceneContext
    ? `场景上下文：\n- 地点：${sceneContext.location || '未指定'}\n- 时间：${sceneContext.timeOfDay || '未指定'}\n- 角色：${sceneContext.characters?.join(', ') || '未指定'}`
    : ''

  const userPrompt = `请优化以下场景描述，使其更适合AI视频生成：

原始描述：
${description}

${contextStr}

优化要求：
1. 增加具体的视觉细节（颜色、材质、光线等）
2. 明确主体和背景
3. 添加动态元素（动作、氛围）
4. 保持原意不变

直接返回优化后的描述文字，不要其他内容。`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的AI视频提示词优化专家。' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 500
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('DeepSeek API 返回为空')
      }

      const cost = calculateDeepSeekCost(completion.usage)
      await logDeepSeekChat(modelLog, userPrompt, {
        status: 'completed',
        costCNY: cost.costCNY
      })
      return content.trim()
    } catch (error: any) {
      lastError = error

      if (AUTH_ERROR_STATUS_CODES.includes(error?.status)) {
        await logDeepSeekChat(modelLog, userPrompt, {
          status: 'failed',
          errorMsg: error?.message || 'auth'
        })
        throw new DeepSeekAuthError()
      }

      if (error?.status === RATE_LIMIT_STATUS_CODE || error?.message?.includes('rate_limit')) {
        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          await sleep(AUTH_RETRY_DELAY_MS * attempt)
          continue
        }
        await logDeepSeekChat(modelLog, userPrompt, { status: 'failed', errorMsg: 'rate_limit' })
        throw new DeepSeekRateLimitError()
      }

      if (attempt < DEFAULT_RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS)
        continue
      }
    }
  }

  await logDeepSeekChat(modelLog, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '场景描述优化失败'
  })
  throw lastError || new Error('场景描述优化失败')
}

// ==================== Helper Functions ====================

function getDeepSeekClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
  })
}

function buildUserPrompt(idea: string, options?: ScriptWriterOptions): string {
  let prompt = `请根据以下想法创作一个短视频剧本：

想法：${idea}`

  if (options?.characters && options.characters.length > 0) {
    const characterList = options.characters
      .map(c => `- ${c.name}: ${c.description || '未描述'}`)
      .join('\n')
    prompt += `\n\n角色设定：\n${characterList}`
  }

  if (options?.projectContext) {
    prompt += `\n\n项目背景：\n${options.projectContext}`
  }

  return prompt
}

function parseScriptResponse(content: string): ScriptContent {
  // 清理返回内容，移除可能的 markdown 代码块
  let cleanContent = content
  if (content.includes('```json')) {
    cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }

  // 移除可能的引号包裹
  if (cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
    cleanContent = cleanContent.slice(1, -1)
  }

  // 尝试解析JSON
  try {
    const parsed = JSON.parse(cleanContent)
    return convertToScriptContent(parsed)
  } catch {
    // 如果直接解析失败，尝试提取 JSON 部分
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return convertToScriptContent(JSON.parse(jsonMatch[0]))
    }
    throw new Error('剧本格式不正确，无法解析')
  }
}

function convertToScriptContent(data: any): ScriptContent {
  // 处理可能的嵌套结构
  let scenesArray: any[] = []

  // 支持 scenes 或 segments（segment 是新的命名）
  if (Array.isArray(data.scenes)) {
    scenesArray = data.scenes
  } else if (Array.isArray(data.segments)) {
    scenesArray = data.segments
  } else if (Array.isArray(data.episodes) && data.episodes.length > 0) {
    // 兼容嵌套 episodes 结构
    scenesArray = data.episodes[0].scenes || data.episodes[0].segments || []
  }

  const scenes: ScriptScene[] = scenesArray.map((s: any, index: number) => {
    // 处理 dialogues
    let dialogues: ScriptDialogueLine[] = []
    if (Array.isArray(s.dialogues)) {
      dialogues = s.dialogues.map((d: any) => ({
        character: d.character || d.name || '',
        content: d.content || d.line || ''
      }))
    } else if (s.dialogue && typeof s.dialogue === 'object') {
      dialogues = Object.entries(s.dialogue).map(([character, content]) => ({
        character,
        content: content as string
      }))
    }

    // 处理 actions
    let actions: string[] = []
    if (Array.isArray(s.actions)) {
      actions = s.actions
    } else if (typeof s.action === 'string') {
      actions = s.action.split(/(?<=[。！？；.!?;])/).filter(Boolean)
    }

    return {
      sceneNum: s.segmentNum || s.sceneNum || s.scene_number || index + 1,
      location: s.location || '',
      timeOfDay: s.timeOfDay || s.time || '日',
      characters: Array.isArray(s.characters) ? s.characters : [],
      description: s.description || '',
      dialogues,
      actions
    }
  })

  // 处理 metadata
  const metadata = data.metadata || {}

  return {
    title: data.title || data.episode_title || '未命名剧本',
    summary: data.summary || '',
    scenes
  }
}

function validateScript(script: ScriptContent): void {
  if (!script.title) {
    throw new Error('剧本缺少标题')
  }

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('剧本缺少场景')
  }

  for (const scene of script.scenes) {
    if (!scene.location) {
      throw new Error(`场景${scene.sceneNum}缺少地点描述`)
    }
    if (!scene.description) {
      throw new Error(`场景${scene.sceneNum}缺少场景描述`)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
