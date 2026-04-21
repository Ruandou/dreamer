/**
 * Derivative prompt builder for character image slots — pure function
 */

/**
 * Build a derivative prompt that anchors to the base character image.
 * If the prompt already contains identity-preserving phrases, returns as-is.
 * Otherwise, prepends an anchor referencing the base image description.
 */
export function buildDerivativePrompt(
  baseAnchor: string | null | undefined,
  derivativePrompt: string
): string {
  const d = derivativePrompt.trim()
  if (!d) return d
  if (/same\s+(person|identity|character|face)/i.test(d)) return d
  if (/base\s+reference/i.test(d)) return d
  if (/unchanged|consistent\s+with/i.test(d)) return d
  if (/同一人|与基础|保持一致|参考基础|与基础定妆|相同人物|同一人物/i.test(d)) return d

  const b = (baseAnchor || '').trim().replace(/\s+/g, ' ')
  if (b.length >= 12) {
    return `与基础定妆为同一人；保持与基础形象一致的特征（${b.slice(0, 220)}）；本套仅变化：${d}`
  }
  return `与基础定妆为同一人；保持面部结构与年龄感一致；${d}`
}
