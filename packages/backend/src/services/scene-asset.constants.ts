/**
 * 场景素材匹配相关常量
 * 集中管理优先级、相关度评分、最大数量等魔法数字
 */

// ==================== 素材优先级 ====================

/** 素材优先级（数字越大越优先） */
export const ASSET_PRIORITY = {
  /** 氛围素材 - 最低优先级 */
  ATMOSPHERE: 1,
  /** 背景素材 - 中等优先级 */
  BACKGROUND: 2,
  /** 角色素材 - 最高优先级 */
  CHARACTER: 3
} as const

// ==================== 相关度评分 ====================

/** 素材匹配相关度评分 */
export const ASSET_RELEVANCE = {
  /** 角色匹配 - 非常高 */
  CHARACTER_MATCH: 0.95,
  /** 氛围匹配 - 较高 */
  ATMOSPHERE_MATCH: 0.7,
  /** 风格匹配 - 中等 */
  STYLE_MATCH: 0.6,
  /** 未知位置 - 中等 */
  UNKNOWN_LOCATION: 0.5,
  /** 部分匹配 - 较低 */
  PARTIAL_MATCH: 0.3,
  /** 包含关系匹配 - 较高 */
  CONTAINS_MATCH: 0.8,
  /** 完全匹配 - 最高 */
  EXACT_MATCH: 1.0,
  /** 关键词匹配 - 中等 */
  KEYWORD_MATCH: 0.6
} as const

// ==================== 数量限制 ====================

/** 每场景最大素材数 */
export const MAX_ASSETS_PER_SCENE = 5

/** Seedance 参考图最大数量 */
export const MAX_REFERENCE_IMAGES = 9

/** 关键词匹配最小长度 */
export const MIN_KEYWORD_LENGTH = 2

// ==================== 风格关键词 ====================

/** 用于检测场景描述中风格的关键词 */
export const STYLE_KEYWORDS = ['古风', '现代', '科幻', '赛博', '仙侠', '动漫'] as const

// ==================== 时间氛围映射 ====================

/** 时间段对应的氛围描述 */
export const TIME_ATMOSPHERE_MAP: Record<string, string> = {
  日: '温暖阳光，明亮色调',
  夜: '月光夜色，神秘氛围',
  晨: '清晨曙光，柔和光线',
  昏: '黄昏暮色，温暖余晖'
} as const

/** 默认时间段 */
export const DEFAULT_TIME_OF_DAY = '日'

/** 默认风格 */
export const DEFAULT_VIDEO_STYLE = 'mixed'

/** 默认风格类型 */
export const DEFAULT_STYLE_TYPE = '通用'
