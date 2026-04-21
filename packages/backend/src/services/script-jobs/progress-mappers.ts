/**
 * Progress mapping utilities — pure functions for converting job progress percentages
 */

/**
 * Map batch progress percentage to the parse-script embedded range (8–28%).
 */
export function mapBatchProgressToParseRange(batchPct: number): number {
  return Math.min(28, 8 + Math.round((Math.min(100, batchPct) / 100) * 20))
}

/**
 * Calculate episode progress percentage (0–100) based on current and total episodes.
 */
export function calcEpisodePct(current: number, total: number): number {
  return Math.round(((current - 1) / Math.max(1, total - 1)) * 100)
}

/**
 * Map percentage to three-phase progress range (20–95%).
 */
export function mapThreePhaseProgress(pct: number): number {
  return 20 + Math.round((pct / 100) * 75)
}

/**
 * Map percentage to legacy progress (capped at 99%).
 */
export function mapLegacyProgress(pct: number): number {
  return Math.min(99, pct)
}
