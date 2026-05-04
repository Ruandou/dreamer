import type { ModelCallLogContext } from './api-logger.js'
import { type DeepSeekCost } from './deepseek-client.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai.constants.js'
import { callLLMWithRetry, type LLMCallOptions } from './llm-call-wrapper.js'

export async function optimizePrompt(
  prompt: string,
  context?: string,
  log?: ModelCallLogContext
): Promise<{ optimized: string; cost: DeepSeekCost }> {
  const userPrompt = context
    ? `上下文：${context}\n\n原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`
    : `原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`

  // Simple parser - just return the content as-is
  const parseResponse = (content: string): string => content

  const callOptions: LLMCallOptions = {
    messages: [
      { role: 'system', content: '你是一个专业的AI视频提示词优化专家。' },
      { role: 'user', content: userPrompt }
    ],
    temperature: DEEPSEEK_TEMPERATURE.SCENE_PROMPT_OPTIMIZE,
    maxTokens: DEEPSEEK_MAX_TOKENS.SCENE_PROMPT_OPTIMIZE,
    modelLog: log
  }

  const result = await callLLMWithRetry(callOptions, parseResponse)

  return {
    optimized: result.content,
    cost: result.cost
  }
}
