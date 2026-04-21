/**
 * 项目级默认画幅：与 Scene.aspectRatio、方舟文生图尺寸对齐。
 */

export const PROJECT_DEFAULT_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const

export type ProjectDefaultAspectRatio = (typeof PROJECT_DEFAULT_ASPECT_RATIOS)[number]

const ALLOWED_ASPECT_RATIOS = new Set<string>(PROJECT_DEFAULT_ASPECT_RATIOS)

/** Fallback ratio when input is invalid or empty. */
const FALLBACK_ASPECT_RATIO = '9:16'

/** Validate before writing to DB / API; fall back to 9:16 for illegal values. */
export function normalizeProjectDefaultAspectRatio(input: string | undefined | null): string {
  const trimmed = (input || '').trim()
  if (ALLOWED_ASPECT_RATIOS.has(trimmed)) return trimmed
  return FALLBACK_ASPECT_RATIO
}

/**
 * Pipeline / storyboard only support three ratios.
 * If the project default is 4:3 etc., fall back to portrait 9:16.
 */
export function pipelineAspectRatioFromProjectDefault(
  aspect: string | undefined | null
): '16:9' | '9:16' | '1:1' {
  const normalized = normalizeProjectDefaultAspectRatio(aspect)
  if (normalized === '16:9' || normalized === '9:16' || normalized === '1:1') return normalized
  return FALLBACK_ASPECT_RATIO
}
