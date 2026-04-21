/**
 * AI 自动生成视觉风格配置
 * 根据项目描述/梗概推断合适的视觉风格
 */

import type { VisualStyleConfig } from '@dreamer/shared'
import { VISUAL_STYLE_PRESETS } from '@dreamer/shared'
import { callLLMWithRetry } from './llm-call-wrapper.js'
import { getDefaultProvider } from './llm-factory.js'
import type { ModelCallLogContext } from './api-logger.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai.constants.js'

const SYSTEM_PROMPT = `你是短剧视觉风格分析专家。根据项目描述和梗概，推断最合适的视觉风格配置。

必须返回合法 JSON（不要 markdown），结构为：
{
  "preset": "预设ID（从下方列表中匹配最接近的，若无匹配则为null）",
  "era": "时代类型",
  "artStyle": ["艺术风格数组"],
  "colorMood": ["色调氛围数组"],
  "quality": "画质等级",
  "customKeywords": ["自定义关键词数组"]
}

可用预设列表：
${VISUAL_STYLE_PRESETS.map((p) => `- ${p.id}: ${p.name}（${p.description}）`).join('\n')}

时代类型：ancient_china, xianxia, wuxia, modern, republic, futuristic, custom
艺术风格：photorealistic, cinematic, stylized_realism, anime, chinese_painting, dark_fantasy, ethereal
色调氛围：warm, cool, high_contrast, low_contrast, desaturated, vibrant, golden_hour, moonlight
画质等级：standard, high, cinema, artistic

推断规则：
1. 优先匹配预设包（若描述符合某个预设的主题）
2. 根据关键词推断时代（仙侠/修仙→xianxia，古代/王朝→ancient_china，都市/现代→modern）
3. 艺术风格：写实/真实→photorealistic，电影/影视→cinematic，动漫/动画→anime
4. 色调：温暖/阳光→warm，冷酷/暗黑→cool，仙侠/缥缈→vibrant+golden_hour
5. 画质默认 cinema`

export async function generateVisualStyleConfig(
  input: {
    name: string
    description?: string | null
    synopsis?: string | null
  },
  log?: ModelCallLogContext
): Promise<VisualStyleConfig> {
  const provider = getDefaultProvider()

  const userInput = [
    `项目名称：${input.name}`,
    input.description ? `项目描述：${input.description}` : '',
    input.synopsis ? `故事梗概：${input.synopsis}` : '',
    '请分析并返回视觉风格配置 JSON。'
  ]
    .filter(Boolean)
    .join('\n')

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: userInput }
  ]

  const result = await callLLMWithRetry<VisualStyleConfig>(
    {
      provider,
      messages,
      temperature: DEEPSEEK_TEMPERATURE.VISUAL_STYLE,
      maxTokens: DEEPSEEK_MAX_TOKENS.VISUAL_STYLE,
      modelLog: log
    },
    (content) => {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonText = jsonMatch ? jsonMatch[1] : content
      const parsed = JSON.parse(jsonText) as VisualStyleConfig

      if (!parsed.era || !parsed.artStyle || !parsed.colorMood || !parsed.quality) {
        throw new Error('视觉风格配置缺少必要字段')
      }

      return parsed
    }
  )

  if (!result.content) {
    throw new Error('AI 未返回有效的视觉风格配置')
  }

  return result.content
}
