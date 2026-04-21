/**
 * Progress mapping utilities — pure functions for converting job progress percentages.
 *
 * These mappers translate internal episode/batch percentages into the narrower
 * ranges used by the PipelineJob UI so that each major phase (outline, review,
 * script, parse) occupies a distinct slice of the overall 0–100 % bar.
 */

/** Maximum percentage value used across all mappers. */
const FULL_PERCENTAGE = 100

/** Parse-script embedded phase range (8–28 %). */
const PARSE_RANGE_MIN = 8
const PARSE_RANGE_MAX = 28
const PARSE_RANGE_SPAN = PARSE_RANGE_MAX - PARSE_RANGE_MIN // 20

/** Three-phase script-generation range (20–95 %). */
const THREE_PHASE_MIN = 20
const THREE_PHASE_SPAN = 75 // 95 - 20

/** Legacy mode hard cap (leaves 100 % for final completion signal). */
const LEGACY_CAP = 99

/**
 * Map batch progress percentage to the parse-script embedded range (8–28 %).
 *
 * Used when script-batch runs *inside* parse-script so its progress does not
 * overflow the 30 % slot reserved for the parse phase.
 */
export function mapBatchProgressToParseRange(batchPercentage: number): number {
  const clamped = Math.min(FULL_PERCENTAGE, batchPercentage)
  const mapped = PARSE_RANGE_MIN + Math.round((clamped / FULL_PERCENTAGE) * PARSE_RANGE_SPAN)
  return Math.min(PARSE_RANGE_MAX, mapped)
}

/**
 * Calculate episode progress percentage (0–100 %) based on current and total episodes.
 *
 * First episode starts at 0 %; last episode reaches 100 %.
 */
export function calculateEpisodePercentage(current: number, total: number): number {
  const safeTotal = Math.max(1, total - 1)
  return Math.round(((current - 1) / safeTotal) * FULL_PERCENTAGE)
}

/**
 * Map percentage to three-phase progress range (20–95 %).
 *
 * The 5 % head-room below 100 % is reserved for the final "completed" update.
 */
export function mapThreePhaseProgress(percentage: number): number {
  return THREE_PHASE_MIN + Math.round((percentage / FULL_PERCENTAGE) * THREE_PHASE_SPAN)
}

/**
 * Map percentage to legacy progress (capped at 99 %).
 *
 * Legacy mode never reports 100 % until the caller explicitly sets it,
 * preventing premature "completed" UI state.
 */
export function mapLegacyProgress(percentage: number): number {
  return Math.min(LEGACY_CAP, percentage)
}
