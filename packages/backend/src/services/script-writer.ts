import OpenAI from 'openai'
import type {
  ScriptContent,
  ScriptScene,
  ScriptDialogueLine,
  Character
} from '@dreamer/shared/types'
import type { DeepSeekCost } from './ai/deepseek.js'
import type { ModelCallLogContext } from './ai/api-logger.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai/ai.constants.js'
import { SCRIPT_WRITER_PROMPT, EPISODE_WRITER_PROMPT } from './prompts/script-prompts.js'
import {
  callDeepSeekWithRetry,
  cleanMarkdownCodeBlocks,
  type DeepSeekCallOptions
} from './ai/deepseek-call-wrapper.js'
import { PromptRegistry } from './prompts/registry.js'

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

  // Parser function for the wrapper
  const parseScript = (content: string): ScriptContent => {
    const script = parseScriptResponse(content)
    validateScript(script)
    return script
  }

  const options_param: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: SCRIPT_WRITER_PROMPT,
    userPrompt,
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_WRITING,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_WRITING,
    modelLog: options?.modelLog
  }

  const result = await callDeepSeekWithRetry(options_param, parseScript)

  return {
    script: result.content,
    cost: result.cost
  }
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

  // Parser function for the wrapper
  const parseScript = (content: string): ScriptContent => {
    const script = parseScriptResponse(content)
    validateScript(script)
    return script
  }

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: EPISODE_WRITER_PROMPT,
    userPrompt,
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_IMPROVEMENT,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_IMPROVEMENT,
    modelLog
  }

  const result = await callDeepSeekWithRetry(options, parseScript)

  return {
    script: result.content,
    cost: result.cost
  }
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

  // Parser function for the wrapper
  const parseScript = (content: string): ScriptContent => {
    const parsed = parseScriptResponse(content)
    validateScript(parsed)
    return parsed
  }

  const options_param: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: SCRIPT_WRITER_PROMPT,
    userPrompt,
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_WRITING,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_WRITING,
    modelLog: options?.modelLog
  }

  const result = await callDeepSeekWithRetry(options_param, parseScript)

  return {
    script: result.content,
    cost: result.cost
  }
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

  // Parser function for the wrapper
  const parseScript = (content: string): ScriptContent => {
    const improvedScript = parseScriptResponse(content)
    validateScript(improvedScript)
    return improvedScript
  }

  const options_param: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: SCRIPT_WRITER_PROMPT,
    userPrompt,
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_WRITING,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_WRITING,
    modelLog: options?.modelLog
  }

  const result = await callDeepSeekWithRetry(options_param, parseScript)

  return {
    script: result.content,
    cost: result.cost
  }
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

  // Simple parser - just return the content
  const parseResponse = (content: string): string => content.trim()

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: '你是一个专业的AI视频提示词优化专家。',
    userPrompt,
    temperature: 0.5,
    maxTokens: 500,
    modelLog
  }

  const result = await callDeepSeekWithRetry(options, parseResponse)

  return result.content
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
      .map((c) => `- ${c.name}: ${c.description || '未描述'}`)
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
    cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
  }

  // 移除可能的引号包裹
  if (cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
    cleanContent = cleanContent.slice(1, -1)
  }

  // 尝试解析JSON
  try {
    const parsed = JSON.parse(cleanContent)
    return convertToScriptContent(parsed)
  } catch (error) {
    // 如果直接解析失败，尝试提取 JSON 部分
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return convertToScriptContent(JSON.parse(jsonMatch[0]))
      } catch (innerError) {
        console.error('[script-writer] JSON extract failed')
        console.error(
          '[script-writer] Raw content (first 500 chars):',
          cleanContent.substring(0, 500)
        )
        console.error(
          '[script-writer] Extracted JSON (first 500 chars):',
          jsonMatch[0].substring(0, 500)
        )
        console.error('[script-writer] Error:', innerError)
        throw new Error(
          `剧本JSON格式不正确: ${innerError instanceof Error ? innerError.message : '未知错误'}`
        )
      }
    }
    console.error('[script-writer] No JSON found in response')
    console.error('[script-writer] Content (first 500 chars):', cleanContent.substring(0, 500))
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
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 生成单集核心剧情大纲（100-200字）
 * 用于三阶段生成的第一阶段：并行生成所有集的大纲
 */
export async function generateEpisodeOutline(
  episodeNum: number,
  seriesTitle: string,
  seriesSynopsis: string,
  modelLog?: ModelCallLogContext
): Promise<string> {
  const deepseek = getDeepSeekClient()
  const registry = PromptRegistry.getInstance()

  const rendered = registry.render('episode-outline', {
    seriesTitle,
    seriesSynopsis,
    episodeNum: String(episodeNum)
  })

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: rendered.systemPrompt,
    userPrompt: rendered.userPrompt,
    temperature: 0.5,
    maxTokens: 400,
    modelLog
  }

  // 大纲生成不需要复杂的解析，直接返回文本
  const result = await callDeepSeekWithRetry(options, (content: string) => content.trim())

  return result.content
}

/**
 * AI 总编剧审核所有大纲的一致性
 * 用于三阶段生成的第二阶段：质量门控
 */
export async function showrunnerReviewOutlines(
  seriesSynopsis: string,
  outlines: Map<number, string>,
  modelLog?: ModelCallLogContext
): Promise<{ approved: boolean; feedback: string }> {
  const deepseek = getDeepSeekClient()
  const registry = PromptRegistry.getInstance()

  // 格式化大纲列表
  const outlinesList = Array.from(outlines.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, outline]) => `第${num}集：${outline}`)
    .join('\n\n')

  const rendered = registry.render('showrunner-review', {
    seriesSynopsis,
    totalEpisodes: String(outlines.size),
    outlinesList
  })

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: rendered.systemPrompt,
    userPrompt: rendered.userPrompt,
    temperature: 0.3,
    maxTokens: 2000,
    modelLog
  }

  const result = await callDeepSeekWithRetry(options, (content: string) => content.trim())
  const feedback = result.content

  // 检查是否通过审核
  const approved = feedback.includes('APPROVED')

  return { approved, feedback }
}

/**
 * 将原始剧本格式化为标准 JSON（忠实解析，不改变内容）
 * @param originalScript 原始剧本文本
 * @param modelLog 模型调用日志上下文
 */
export async function formatScriptToJSON(
  originalScript: string,
  modelLog?: ModelCallLogContext
): Promise<ScriptContent> {
  const deepseek = getDeepSeekClient()
  const registry = PromptRegistry.getInstance()

  const rendered = registry.render('script-formatter', {
    originalScript
  })

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: rendered.systemPrompt,
    userPrompt: rendered.userPrompt,
    temperature: 0.1,
    maxTokens: 8000,
    modelLog
  }

  const result = await callDeepSeekWithRetry(options, (content: string) => {
    const cleaned = cleanMarkdownCodeBlocks(content)
    return JSON.parse(cleaned) as ScriptContent
  })

  return result.content
}

/**
 * 基于大纲/片段扩展为完整剧本
 * @param episodeNum 集数
 * @param seriesTitle 剧名
 * @param seriesSynopsis 全剧梗概
 * @param outlineContent 用户提供的大纲/片段
 * @param modelLog 模型调用日志上下文
 */
export async function expandEpisodeFromOutline(
  episodeNum: number,
  seriesTitle: string,
  seriesSynopsis: string,
  outlineContent: string,
  modelLog?: ModelCallLogContext
): Promise<ScriptContent> {
  const deepseek = getDeepSeekClient()
  const registry = PromptRegistry.getInstance()

  const rendered = registry.render('episode-expand', {
    seriesTitle,
    seriesSynopsis,
    outlineContent
  })

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: rendered.systemPrompt,
    userPrompt: rendered.userPrompt,
    temperature: 0.6,
    maxTokens: 6000,
    modelLog
  }

  const result = await callDeepSeekWithRetry(options, (content: string) => {
    const cleaned = cleanMarkdownCodeBlocks(content)
    return JSON.parse(cleaned) as ScriptContent
  })

  return result.content
}

/**
 * 根据审核意见修正大纲
 * @param seriesSynopsis 全剧梗概
 * @param outlines 当前大纲
 * @param reviewFeedback 审核意见
 * @param modelLog 模型调用日志上下文
 * @returns 修正后的大纲
 */
export async function reviseOutlinesBasedOnFeedback(
  seriesSynopsis: string,
  outlines: Map<number, string>,
  reviewFeedback: string,
  modelLog?: ModelCallLogContext
): Promise<Map<number, string>> {
  const deepseek = getDeepSeekClient()
  const registry = PromptRegistry.getInstance()

  // 格式化大纲列表
  const outlinesList = Array.from(outlines.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, outline]) => `第${num}集：${outline}`)
    .join('\n\n')

  const rendered = registry.render('outline-revision', {
    seriesSynopsis,
    totalEpisodes: String(outlines.size),
    outlinesList,
    reviewFeedback
  })

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: rendered.systemPrompt,
    userPrompt: rendered.userPrompt,
    temperature: 0.4,
    maxTokens: 4000,
    modelLog
  }

  const result = await callDeepSeekWithRetry(options, (content: string) => content.trim())
  const revisedText = result.content

  // 解析修正后的大纲文本，转换为 Map
  return parseOutlinesFromText(revisedText, outlines.size)
}

/**
 * 从文本中解析大纲列表
 * 期望格式：第1集：...\n第2集：...\n...
 */
function parseOutlinesFromText(text: string, expectedCount: number): Map<number, string> {
  const outlines = new Map<number, string>()

  // 匹配 "第N集：..." 格式
  const regex = /第(\d+)集[：:]\s*([\s\S]*?)(?=第\d+集[：:]|$)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const episodeNum = parseInt(match[1], 10)
    const outline = match[2].trim()
    if (episodeNum >= 1 && episodeNum <= expectedCount && outline) {
      outlines.set(episodeNum, outline)
    }
  }

  return outlines
}
