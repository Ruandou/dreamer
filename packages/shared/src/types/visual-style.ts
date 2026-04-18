/**
 * 项目视觉风格类型定义
 * 4 个维度：时代背景 + 艺术风格 + 色调氛围 + 画质等级
 */

/** 时代背景 - 定义故事发生的时代 */
export const ERA_TYPES = [
  'ancient_china', // 中国古代（汉朝至明朝）
  'xianxia', // 仙侠玄幻（修仙世界）
  'wuxia', // 武侠江湖（古代武侠）
  'modern', // 现代都市（当代城市）
  'republic', // 民国时期（1912-1949）
  'futuristic', // 未来科幻（赛博朋克）
  'custom' // 自定义（混合或特殊）
] as const

export type EraType = (typeof ERA_TYPES)[number]

/** 艺术风格 - 定义视觉呈现手法 */
export const ART_STYLE_TYPES = [
  'photorealistic', // 超写实（接近真实照片）
  'cinematic', // 电影感（电影级光影）
  'stylized_realism', // 风格化写实（写实基础上艺术化）
  'anime', // 动漫（日式动漫风格）
  'chinese_painting', // 中国风（水墨、国画）
  'dark_fantasy', // 暗黑奇幻（哥特、暗黑）
  'ethereal' // 空灵飘逸（仙气、梦幻）
] as const

export type ArtStyleType = (typeof ART_STYLE_TYPES)[number]

/** 色调氛围 - 定义色彩倾向和情绪 */
export const COLOR_MOOD_TYPES = [
  'warm', // 暖色调（温馨、浪漫）
  'cool', // 冷色调（冷静、神秘）
  'high_contrast', // 高对比（强烈明暗）
  'low_contrast', // 低对比（柔和、平淡）
  'desaturated', // 低饱和（复古、压抑）
  'vibrant', // 高饱和（鲜艳、活泼）
  'golden_hour', // 黄金时刻（日出日落暖光）
  'moonlight' // 月光冷调（夜晚冷光）
] as const

export type ColorMoodType = (typeof COLOR_MOOD_TYPES)[number]

/** 画质等级 - 定义输出质量标准 */
export const QUALITY_LEVEL_TYPES = [
  'standard', // 标准（常规画质）
  'high', // 高清（较高画质）
  'cinema', // 电影级（最高画质）
  'artistic' // 艺术级（强调艺术感）
] as const

export type QualityLevelType = (typeof QUALITY_LEVEL_TYPES)[number]

/** 视觉风格配置 */
export interface VisualStyleConfig {
  /** 预设包 ID（可选，用于快速配置） */
  preset?: string

  /** 时代背景 */
  era: EraType

  /** 艺术风格（1-2 个） */
  artStyle: ArtStyleType[]

  /** 色调氛围（1-2 个） */
  colorMood: ColorMoodType[]

  /** 画质等级 */
  quality: QualityLevelType

  /** 自定义关键词（可选） */
  customKeywords?: string[]
}

/** 视觉风格预设包 */
export interface VisualStylePreset {
  /** 预设 ID */
  id: string

  /** 预设名称 */
  name: string

  /** 预设描述 */
  description: string

  /** 时代背景 */
  era: EraType

  /** 艺术风格 */
  artStyle: ArtStyleType[]

  /** 色调氛围 */
  colorMood: ColorMoodType[]

  /** 画质等级 */
  quality: QualityLevelType

  /** 关键词列表 */
  keywords: string[]

  /** 示例提示词 */
  examplePrompt: string
}

/** 维度标签（用于 UI 显示） */
export interface DimensionLabel {
  value: string
  label: string
  labelEn: string
  description: string
}
