import OpenAI from 'openai'
import type { ScriptContent, ScriptScene, Dialogue } from '@shared/types'

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
})

const SYSTEM_PROMPT = `你是一个专业的短剧剧本作家，擅长创作古装穿越/技术流逆袭类短剧。
请根据用户提供的故事梗概，扩展为结构化的短剧剧本。

剧本格式要求：
- 分成多个场景
- 每个场景包含：场景编号、地点、时间（日/夜）、出现的角色、场景描述、对话、动作描述
- 对话要符合角色性格，简洁有力
- 动作描述要具体，便于视频生成

请直接返回JSON格式，不要包含其他文字。`

export async function expandScript(summary: string, projectContext?: string): Promise<ScriptContent> {
  const userPrompt = projectContext
    ? `项目背景：${projectContext}\n\n故事梗概：${summary}`
    : `故事梗概：${summary}`

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 4000
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('DeepSeek API 返回为空')
  }

  try {
    // 尝试解析JSON
    const script = JSON.parse(content) as ScriptContent

    // 验证结构
    if (!script.title || !script.summary || !Array.isArray(script.scenes)) {
      throw new Error('剧本格式不正确')
    }

    return script
  } catch (error) {
    console.error('Failed to parse DeepSeek response:', content)
    throw new Error('剧本生成失败，请重试')
  }
}

export async function optimizePrompt(prompt: string, context?: string): Promise<string> {
  const userPrompt = context
    ? `上下文：${context}\n\n原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`
    : `原始提示词：${prompt}\n\n请优化这个提示词，使其更适合视频生成模型使用。保持关键视觉元素，移除模糊描述，添加具体细节。`

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个专业的AI视频提示词优化专家。' },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.5,
    max_tokens: 1000
  })

  return completion.choices[0]?.message?.content || prompt
}
