/**
 * Build a location establishing-shot prompt.
 *
 * Why no visual-style prefix: the full imagePrompt already includes style and
 * quality descriptors during visual enrichment; prepending again would duplicate.
 */
export function buildLocationEstablishingPrompt(
  establishingName: string,
  effectivePrompt: string
): string {
  return `${establishingName}. ${effectivePrompt}`
}

/** Check whether a non-empty establishing image URL exists. */
export function locationHasEstablishingImage(imageUrl: string | null | undefined): boolean {
  return Boolean(imageUrl && String(imageUrl).trim())
}
