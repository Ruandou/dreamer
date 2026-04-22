/**
 * Seedance 2.0 参数优化相关常量
 */

/** 参考图时长限制（秒） */
export const SEEDANCE_DURATION = {
  MIN: 4,
  MAX: 15
} as const

/** 提示词长度限制（字符） */
export const SEEDANCE_PROMPT = {
  MIN_LENGTH: 10,
  MAX_LENGTH: 1000
} as const

/** 参考图最大数量 */
export const SEEDANCE_MAX_REFERENCE_IMAGES = 9

/** 成本计算：每秒价格（元） */
export const SEEDANCE_COST_PER_SECOND = 1.0

/** 参考图配额分配策略 */
export const REFERENCE_IMAGE_ALLOCATION = {
  character: { min: 2, max: 3, priority: 3 },
  background: { min: 1, max: 2, priority: 2 },
  atmosphere: { min: 1, max: 2, priority: 1 },
  style: { min: 0, max: 1, priority: 1 },
  action: { min: 1, max: 2, priority: 2 },
  reserve: { count: 1 }
} as const

/** 可变配额状态（运行时使用） */
export interface MutableAllocation {
  character: { min: number; max: number }
  background: { min: number; max: number }
  atmosphere: { min: number; max: number }
  style: { min: number; max: number }
  action: { min: number; max: number }
  reserve: { count: number }
}

/** 画质锚定词 */
export const QUALITY_ANCHORS = {
  cinematic: ['电影', '史诗', '大片'],
  keywords: ['8K超高清', 'cinematic film grain']
} as const

/** 时间段光影描述 */
export const TIME_OF_DAY_LIGHTING = {
  夜: '月光/灯光氛围，神秘暗调',
  日: '自然采光，明亮氛围',
  昏: '黄昏暖调，柔和光线'
} as const
