/**
 * JSON extraction from markdown/code blocks — pure function
 */

/**
 * Extract a JSON object string from text that may be wrapped in markdown fences.
 * Handles ```json ... ``` fences and finds the outermost { ... } block.
 */
export function extractJsonObject(text: string): string {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) return fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) return t.slice(start, end + 1)
  return t
}
