import type { ModelCallLogContext } from './api-logger.js'
import { getDeepSeekClient, type DeepSeekCost } from './deepseek-client.js'
import {
  DEEPSEEK_TEMPERATURE,
  DEEPSEEK_MAX_TOKENS
} from './ai.constants.js'
import {
  callDeepSeekWithRetry,
  type DeepSeekCallOptions
} from './deepseek-call-wrapper.js'

export async function optimizePrompt(
  prompt: string,
  context?: string,
  log?: ModelCallLogContext
): Promise<{ optimized: string; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  const userPrompt = context
    ? `上下文：${context}\n\n原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`
    : `原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`

  // Simple parser - just return the content as-is
  const parseResponse = (content: string): string => content

  const options: DeepSeekCallOptions = {
    client: deepseek,
    model: 'deepseek-chat',
    systemPrompt: '你是一个专业的AI视频提示词优化专家。',
    userPrompt,
    temperature: DEEPSEEK_TEMPERATURE.SCENE_PROMPT_OPTIMIZE,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCENE_PROMPT_OPTIMIZE,
    modelLog: log
  }

  const result = await callDeepSeekWithRetry(options, parseResponse)

  return {
    optimized: result.content,
    cost: result.cost
  }
}
