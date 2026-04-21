/**
 * Build a character image prompt by prepending the project's visual style.
 *
 * Why separate: the visual style is managed at project level while the core
 * prompt comes from character identity / outfit descriptions.
 */
export function buildCharacterImageStyledPrompt(
  visualStyle: string[] | undefined,
  corePrompt: string
): string {
  const styleText = (visualStyle || []).filter(Boolean).join(', ')
  if (!styleText) return corePrompt
  return `Visual style: ${styleText}. ${corePrompt}`
}
