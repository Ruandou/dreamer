import type { ScriptContent, Character } from '@dreamer/shared/types'
import type { DeepSeekCost } from './ai/deepseek.js'
import type { ModelCallLogContext } from './ai/api-logger.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai/ai.constants.js'
import { SCRIPT_WRITER_PROMPT, EPISODE_WRITER_PROMPT } from './prompts/script-prompts.js'
import {
  callLLMWithRetry,
  cleanMarkdownCodeBlocks,
  type LLMCallOptions
} from './ai/llm-call-wrapper.js'
import { getDefaultProvider } from './ai/llm-factory.js'
import { PromptRegistry } from './prompts/registry.js'
import {
  parseScriptResponse,
  validateScript,
  formatOutlinesList,
  parseOutlinesFromText
} from './script-parsing/index.js'

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
 * 共享的剧本解析函数（parse + validate）
 * 4 个 LLM 调用都使用相同的解析流程
 */
function parseAndValidateScript(content: string): ScriptContent {
  const script = parseScriptResponse(content, {
    cleanMarkdownCodeBlocks
  })
  validateScript(script)
  return script
}

/**
 * 从一句话想法生成专业剧本
 */
export async function writeScriptFromIdea(
  idea: string,
  options?: ScriptWriterOptions
): Promise<ScriptWriterResult> {
  const provider = getDefaultProvider()
  const userPrompt = buildUserPrompt(idea, options)

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SCRIPT_WRITER_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_WRITING,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_WRITING,
    modelLog: options?.modelLog
  }

  const result = await callLLMWithRetry(callOptions, parseAndValidateScript)

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
  const provider = getDefaultProvider()
  const userPrompt = `剧名：${seriesTitle}
全剧梗概：${seriesSynopsis}
前情与已发生剧情摘要：${rollingContext || '（首集后的连续剧情）'}

请只写第 ${episodeNum} 集的剧本 JSON。`

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: EPISODE_WRITER_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_IMPROVEMENT,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_IMPROVEMENT,
    modelLog
  }

  const result = await callLLMWithRetry(callOptions, parseAndValidateScript)

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
  const provider = getDefaultProvider()

  const userPrompt = `请为以下剧本扩展${additionalScenes}个新场景：

当前剧本：
${JSON.stringify(script, null, 2)}

请保持：
1. 相同的风格和基调
2. 角色一致性
3. 故事连贯性

新增场景应该推动剧情发展，增加冲突或揭示新信息。

直接返回JSON格式的完整剧本（包括原有场景+新场景）。`

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SCRIPT_WRITER_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_EXPAND,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_EXPAND,
    modelLog: options?.modelLog
  }

  const result = await callLLMWithRetry(callOptions, parseAndValidateScript)

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
  const provider = getDefaultProvider()

  const userPrompt = `请根据以下反馈改进剧本：

当前剧本：
${JSON.stringify(script, null, 2)}

用户反馈：
${feedback}

请保持剧本的整体结构，只根据反馈进行针对性改进。

直接返回JSON格式的完整剧本。`

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SCRIPT_WRITER_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_IMPROVEMENT,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_IMPROVEMENT,
    modelLog: options?.modelLog
  }

  const result = await callLLMWithRetry(callOptions, parseAndValidateScript)

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
  const provider = getDefaultProvider()

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

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个专业的AI视频提示词优化专家。' },
      { role: 'user', content: userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SCENE_DESCRIPTION,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCENE_DESCRIPTION,
    modelLog
  }

  const result = await callLLMWithRetry(callOptions, (content: string) => content.trim())

  return result.content
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
  const provider = getDefaultProvider()
  const registry = PromptRegistry.getInstance()

  const rendered = registry.render('episode-outline', {
    seriesTitle,
    seriesSynopsis,
    episodeNum: String(episodeNum)
  })

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: rendered.systemPrompt },
      { role: 'user', content: rendered.userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.EPISODE_OUTLINE,
    maxTokens: DEEPSEEK_MAX_TOKENS.EPISODE_OUTLINE,
    modelLog
  }

  // 大纲生成不需要复杂的解析，直接返回文本
  const result = await callLLMWithRetry(callOptions, (content: string) => content.trim())

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
  const provider = getDefaultProvider()
  const registry = PromptRegistry.getInstance()

  const outlinesList = formatOutlinesList(outlines)

  const rendered = registry.render('showrunner-review', {
    seriesSynopsis,
    totalEpisodes: String(outlines.size),
    outlinesList
  })

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: rendered.systemPrompt },
      { role: 'user', content: rendered.userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SHOWRUNNER_REVIEW,
    maxTokens: DEEPSEEK_MAX_TOKENS.SHOWRUNNER_REVIEW,
    modelLog
  }

  const result = await callLLMWithRetry(callOptions, (content: string) => content.trim())
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
  const provider = getDefaultProvider()
  const registry = PromptRegistry.getInstance()

  const rendered = registry.render('script-formatter', {
    originalScript
  })

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: rendered.systemPrompt },
      { role: 'user', content: rendered.userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SCRIPT_FORMATTER,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCRIPT_FORMATTER,
    modelLog
  }

  const result = await callLLMWithRetry(callOptions, (content: string) => {
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
  const provider = getDefaultProvider()
  const registry = PromptRegistry.getInstance()

  const rendered = registry.render('episode-expand', {
    seriesTitle,
    seriesSynopsis,
    outlineContent
  })

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: rendered.systemPrompt },
      { role: 'user', content: rendered.userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.EPISODE_EXPAND,
    maxTokens: DEEPSEEK_MAX_TOKENS.EPISODE_EXPAND,
    modelLog
  }

  const result = await callLLMWithRetry(callOptions, (content: string) => {
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
  const provider = getDefaultProvider()
  const registry = PromptRegistry.getInstance()

  const outlinesList = formatOutlinesList(outlines)

  const rendered = registry.render('outline-revision', {
    seriesSynopsis,
    totalEpisodes: String(outlines.size),
    outlinesList,
    reviewFeedback
  })

  const callOptions: LLMCallOptions = {
    provider,
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: rendered.systemPrompt },
      { role: 'user', content: rendered.userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.OUTLINE_REVISION,
    maxTokens: DEEPSEEK_MAX_TOKENS.OUTLINE_REVISION,
    modelLog
  }

  const result = await callLLMWithRetry(callOptions, (content: string) => content.trim())
  const revisedText = result.content

  // 解析修正后的大纲文本，转换为 Map
  return parseOutlinesFromText(revisedText, outlines.size)
}
