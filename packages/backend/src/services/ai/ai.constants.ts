/**
 * AI 模型调用相关常量
 * 集中管理温度、token 限制、重试次数等魔法数字
 */

// ==================== DeepSeek 模型配置 ====================

/** 默认温度配置（不同任务的创造性程度） */
export const DEEPSEEK_TEMPERATURE = {
  /** 剧本生成 - 较高创造性 */
  SCRIPT_WRITING: 0.7,
  /** 剧本改进 - 高创造性 */
  SCRIPT_IMPROVEMENT: 0.75,
  /** 剧本扩展 - 较高创造性 */
  SCRIPT_EXPAND: 0.7,
  /** 解析 - 低创造性，高准确性 */
  PARSER: 0.3,
  /** 角色身份合并 - 低创造性 */
  CHARACTER_MERGE: 0.25,
  /** 视觉丰富 - 中等创造性 */
  VISUAL_ENRICH: 0.4,
  /** 角色图片提示词 - 中等创造性 */
  CHARACTER_IMAGE_PROMPT: 0.6,
  /** 场景提示词优化 - 中等创造性 */
  SCENE_PROMPT_OPTIMIZE: 0.5,
  /** 分镜脚本生成 - 中等创造性 */
  STORYBOARD_GENERATE: 0.65,
} as const

/** 默认最大 token 限制 */
export const DEEPSEEK_MAX_TOKENS = {
  /** 剧本生成 */
  SCRIPT_WRITING: 4000,
  /** 剧本改进 */
  SCRIPT_IMPROVEMENT: 4000,
  /** 剧本扩展 */
  SCRIPT_EXPAND: 4000,
  /** 解析 - 需要更多 token */
  PARSER: 8000,
  /** 角色身份合并 */
  CHARACTER_MERGE: 6000,
  /** 视觉丰富 */
  VISUAL_ENRICH: 4096,
  /** 角色图片提示词 - 简短输出 */
  CHARACTER_IMAGE_PROMPT: 400,
  /** 场景提示词优化 */
  SCENE_PROMPT_OPTIMIZE: 1000,
  /** 分镜脚本生成 */
  STORYBOARD_GENERATE: 6000,
} as const

// ==================== 重试配置 ====================

/** 默认重试次数 */
export const DEFAULT_RETRY_ATTEMPTS = 2

/** 重试间隔基础时间（毫秒） */
export const RETRY_BASE_DELAY_MS = 1000

/** 认证错误重试延迟（毫秒） */
export const AUTH_RETRY_DELAY_MS = 2000

// ==================== 错误状态码 ====================

/** 认证错误状态码 */
export const AUTH_ERROR_STATUS_CODES = [401, 403] as const

/** 限流错误状态码 */
export const RATE_LIMIT_STATUS_CODE = 429

// ==================== 时间相关 ====================

/** 毫秒转秒的除数 */
export const MS_TO_SECONDS = 1000

/** 默认场景时长槽位最小值（毫秒） */
export const MIN_SCENE_SLOT_DURATION_MS = 1000
