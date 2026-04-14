import type { ModelCallLogContext } from './api-logger.js'
import { logDeepSeekChat } from './model-call-log.js'
import {
  calculateDeepSeekCost,
  getDeepSeekClient,
  DeepSeekAuthError,
  DeepSeekRateLimitError,
  type DeepSeekCost
} from './deepseek-client.js'

export async function optimizePrompt(
  prompt: string,
  context?: string,
  log?: ModelCallLogContext
): Promise<{ optimized: string; cost: DeepSeekCost }> {
  const deepseek = getDeepSeekClient()
  const userPrompt = context
    ? `上下文：${context}\n\n原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`
    : `原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的AI视频提示词优化专家。' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000
      })

      const cost = calculateDeepSeekCost(completion.usage)
      const optimized = completion.choices[0]?.message?.content || prompt

      await logDeepSeekChat(log, userPrompt, { status: 'completed', costCNY: cost.costCNY })
      return { optimized, cost }
    } catch (error: any) {
      lastError = error

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

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
    }
  }

  await logDeepSeekChat(log, userPrompt, {
    status: 'failed',
    errorMsg: lastError?.message || '提示词优化失败'
  })
  throw lastError || new Error('提示词优化失败')
}
