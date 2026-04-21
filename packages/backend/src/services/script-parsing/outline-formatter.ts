/**
 * Outline formatting and parsing utilities — pure functions
 */

/**
 * Format a Map of episode outlines into a sorted text list.
 * Used by showrunner review and outline revision.
 */
export function formatOutlinesList(outlines: Map<number, string>): string {
  return Array.from(outlines.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, outline]) => `第${num}集：${outline}`)
    .join('\n\n')
}

/**
 * Parse outline text into a Map.
 * Expected format: 第1集：...\n第2集：...\n...
 */
export function parseOutlinesFromText(text: string, expectedCount: number): Map<number, string> {
  const outlines = new Map<number, string>()

  // Match "第N集：..." format
  const regex = /第(\d+)集[：:]\s*([\s\S]*?)(?=第\d+集[：:]|$)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const episodeNum = parseInt(match[1], 10)
    const outline = match[2].trim()
    if (episodeNum >= 1 && episodeNum <= expectedCount && outline) {
      outlines.set(episodeNum, outline)
    }
  }

  return outlines
}
