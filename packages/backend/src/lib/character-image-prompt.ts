/**
 * Build a character image prompt by prepending the project's visual style
 * and appending an anti-celebrity guard to prevent resemblance to real people.
 *
 * Why separate: the visual style is managed at project level while the core
 * prompt comes from character identity / outfit descriptions.
 */
export function buildCharacterImageStyledPrompt(
  visualStyle: string[] | undefined,
  corePrompt: string
): string {
  const styleText = (visualStyle || []).filter((s) => s.trim()).join(', ')
  const antiCelebritySuffix = '。原创虚构角色设计，非真实人物，避免与任何现实人物相似。'
  if (!styleText) return `${corePrompt}${antiCelebritySuffix}`
  return `Visual style: ${styleText}. ${corePrompt}${antiCelebritySuffix}`
}
