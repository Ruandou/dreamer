/**
 * Location name normalization and resolution utilities — pure functions
 */

/**
 * Strip common scene prefixes from location names for better DB matching.
 * Removes patterns like "第X场：", "场景：", "内景：", etc.
 */
export function stripLocationNameNoise(s: string): string {
  return s
    .replace(/^第[一二三四五六七八九十百千\d]+场[：:\s]*/u, '')
    .replace(/^(场景|内景|外景|场地|地点)[：:\s]*/u, '')
    .trim()
}

/**
 * Resolve an AI-returned location name to a database location name.
 * Tries multiple normalization strategies: exact match, collapsed whitespace,
 * trailing punctuation removal, and prefix stripping.
 */
export function resolveDbLocationName(
  dbNames: readonly string[],
  aiName: string | undefined
): string | null {
  if (!aiName) return null

  const collapsed = (s: string) => s.replace(/\s+/g, ' ').trim()
  const stripTrailingPeriod = (s: string) => collapsed(s).replace(/[.。．]+$/u, '')

  const tryOne = (raw: string): string | null => {
    const t = collapsed(raw)
    if (!t) return null
    if (dbNames.includes(t)) return t

    const ct = collapsed(t)
    for (const n of dbNames) {
      if (collapsed(n) === ct) return n
    }

    const nt = stripTrailingPeriod(t)
    for (const n of dbNames) {
      if (stripTrailingPeriod(n) === nt) return n
    }

    const stripped = stripLocationNameNoise(t)
    if (stripped !== t) {
      const st = stripTrailingPeriod(stripped)
      for (const n of dbNames) {
        if (stripTrailingPeriod(n) === st || collapsed(n) === collapsed(stripped)) return n
      }
    }

    return null
  }

  return tryOne(aiName)
}
