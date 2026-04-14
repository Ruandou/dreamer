/** 定场图入队：imagePrompt 应在视觉补全中含「风格与画质」与项目 visualStyle，此处不再拼英文 Visual style 前缀以免重复。 */
export function buildLocationEstablishingPrompt(
  establishingName: string,
  effective: string
): string {
  return `${establishingName}. ${effective}`
}

export function locationHasEstablishingImage(imageUrl: string | null | undefined): boolean {
  return !!(imageUrl && String(imageUrl).trim())
}
