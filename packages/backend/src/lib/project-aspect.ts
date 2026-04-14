/**
 * 项目级默认画幅：与 Scene.aspectRatio、方舟文生图尺寸对齐。
 */

export const PROJECT_DEFAULT_ASPECT_RATIOS = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9'
] as const

export type ProjectDefaultAspectRatio = (typeof PROJECT_DEFAULT_ASPECT_RATIOS)[number]

const ALLOWED = new Set<string>(PROJECT_DEFAULT_ASPECT_RATIOS)

/** 写入 DB / API 前校验，非法值回落为 9:16 */
export function normalizeProjectDefaultAspectRatio(input: string | undefined | null): string {
  const s = (input || '').trim()
  if (ALLOWED.has(s)) return s
  return '9:16'
}

/**
 * Pipeline / storyboard 仅支持三种比例；项目若设为 4:3 等则兜底为竖屏 9:16。
 */
export function pipelineAspectRatioFromProjectDefault(
  aspect: string | undefined | null
): '16:9' | '9:16' | '1:1' {
  const n = normalizeProjectDefaultAspectRatio(aspect)
  if (n === '16:9' || n === '9:16' || n === '1:1') return n
  return '9:16'
}
