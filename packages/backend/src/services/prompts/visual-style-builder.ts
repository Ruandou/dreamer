/**
 * 视觉风格提示词构建器
 * 将 VisualStyleConfig 转换为 AI 提示词片段
 */

import type { VisualStyleConfig } from '@dreamer/shared'

/** 时代背景 → 服装/场景词汇映射 */
const ERA_PROMPTS: Record<string, string> = {
  ancient_china: '服装采用中国古代汉服风格：交领右衽、宽袖长摆、丝绸锦缎材质',
  xianxia: '服装采用仙侠风格：道袍、灵蚕纱、天霞锦等仙家织物，飘逸空灵',
  wuxia: '服装采用武侠风格：劲装短打、便于行动、江湖气息',
  modern: '服装采用现代都市风格： contemporary fashion, modern attire',
  republic: '服装采用民国风格：中山装、旗袍、长衫',
  futuristic: '服装采用未来科幻风格：赛博朋克、高科技材质、机械元素'
}

/** 艺术风格 → 画质与镜头词汇 */
const ART_STYLE_PROMPTS: Record<string, string> = {
  photorealistic: 'photorealistic, ultra-detailed, realistic skin texture, photographic quality',
  cinematic: 'cinematic lighting, film grain, anamorphic lens, cinematic composition',
  stylized_realism: 'stylized realism, semi-realistic, painterly quality',
  anime: 'anime style, cel shading, vibrant colors, Japanese animation',
  chinese_painting: 'chinese ink painting style, watercolor, traditional chinese art',
  dark_fantasy: 'dark fantasy, gothic, moody, dramatic shadows',
  ethereal: 'ethereal, dreamy, soft glow, mystical atmosphere, 仙气缭绕'
}

/** 色调氛围 → 光线描述 */
const COLOR_MOOD_PROMPTS: Record<string, string> = {
  warm: '暖色调，色温约 3500K，温馨氛围',
  cool: '冷色调，色温约 5500K，冷静神秘',
  high_contrast: '强烈明暗对比，chiaroscuro lighting, dramatic shadows',
  low_contrast: '柔和均匀光照，soft lighting, low contrast',
  desaturated: '低饱和度，muted colors, vintage tone',
  vibrant: '高饱和度，vivid colors, vibrant palette',
  golden_hour: '黄昏黄金时刻暖光，色温约 3000K，45 度侧光，柔和长影',
  moonlight: '月光冷调，blue tint, cold atmosphere, night scene'
}

/** 画质等级 → 质量词 */
const QUALITY_PROMPTS: Record<string, string> = {
  standard: 'high quality, detailed',
  high: '8K UHD, highly detailed, sharp focus',
  cinema: '8K UHD, cinematic quality, film grade, masterpiece, professional color grading',
  artistic: 'artistic, award-winning photography, fine art, gallery quality'
}

/**
 * 将 VisualStyleConfig 转换为提示词片段
 */
export function buildVisualStylePrompt(config: VisualStyleConfig): string {
  const parts: string[] = []

  // 时代背景
  if (config.era && ERA_PROMPTS[config.era]) {
    parts.push(ERA_PROMPTS[config.era])
  }

  // 艺术风格
  for (const style of config.artStyle || []) {
    if (ART_STYLE_PROMPTS[style]) {
      parts.push(ART_STYLE_PROMPTS[style])
    }
  }

  // 色调氛围
  for (const mood of config.colorMood || []) {
    if (COLOR_MOOD_PROMPTS[mood]) {
      parts.push(COLOR_MOOD_PROMPTS[mood])
    }
  }

  // 画质等级
  if (config.quality && QUALITY_PROMPTS[config.quality]) {
    parts.push(QUALITY_PROMPTS[config.quality])
  }

  // 自定义关键词
  if (config.customKeywords?.length) {
    parts.push(config.customKeywords.join('，'))
  }

  return parts.join('，')
}

/**
 * 获取时代背景提示词
 */
export function getEraPrompt(era: string): string {
  return ERA_PROMPTS[era] || ''
}

/**
 * 获取艺术风格提示词
 */
export function getArtStylePrompt(styles: string[]): string {
  return styles
    .map((s) => ART_STYLE_PROMPTS[s] || '')
    .filter(Boolean)
    .join('，')
}

/**
 * 获取色调氛围提示词
 */
export function getColorMoodPrompt(moods: string[]): string {
  return moods
    .map((m) => COLOR_MOOD_PROMPTS[m] || '')
    .filter(Boolean)
    .join('，')
}

/**
 * 获取画质提示词
 */
export function getQualityPrompt(quality: string): string {
  return QUALITY_PROMPTS[quality] || ''
}
