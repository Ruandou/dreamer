/**
 * project-script-jobs 常量
 * 集中管理大纲页异步 Job 的超时、重试、进度等配置
 */

/** 故事上下文最大截取长度 */
export const STORY_CONTEXT_MAX_LENGTH = 12_000

/** 分集简介回退截取长度 */
export const SYNOPSIS_SLICE_LENGTH = 200

/** 每场预估秒数（用于 EpisodePlan.estimatedDuration） */
export const ESTIMATED_SECONDS_PER_SCENE = 12

/** 默认目标集数 */
export const DEFAULT_TARGET_EPISODES = 36

/** 大纲生成超时（30 分钟） */
export const OUTLINE_GENERATION_TIMEOUT_MS = 30 * 60 * 1000

/** 总编剧审核超时（15 分钟） */
export const SHOWRUNNER_REVIEW_TIMEOUT_MS = 15 * 60 * 1000

/** 视觉增强超时（20 分钟） */
export const VISUAL_ENRICHMENT_TIMEOUT_MS = 20 * 60 * 1000

/** 大纲单集生成最大重试次数 */
export const OUTLINE_MAX_RETRIES = 2

/** 大纲重试基础延迟（毫秒），指数退避 */
export const OUTLINE_BASE_DELAY_MS = 2000

/** 大纲并行生成并发数 */
export const OUTLINE_BATCH_CONCURRENCY = 5

/** 大纲最低合格字数 */
export const OUTLINE_MIN_LENGTH = 50

/** 审核修正最大轮次 */
export const MAX_REVISION_ROUNDS = 2

/** 未来集大纲前瞻数量 */
export const FUTURE_OUTLINE_LOOKAHEAD = 2
