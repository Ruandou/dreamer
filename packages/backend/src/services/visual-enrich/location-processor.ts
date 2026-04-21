/**
 * Location image prompt processor for visual enrichment
 */

import { locationRepository } from '../../repositories/location-repository.js'
import { resolveDbLocationName } from './location-name-utils.js'

interface ParsedLocation {
  name: string
  imagePrompt?: string
}

/**
 * Process location image prompts from AI payload and persist to DB.
 * Returns the count of successfully written location prompts.
 */
export async function processLocationImagePrompts(
  projectId: string,
  payloadLocations: ParsedLocation[] | undefined,
  dbLocationNames: string[],
  sanitize: (text: string) => string
): Promise<number> {
  if (!Array.isArray(payloadLocations)) return 0

  let locationPromptWrites = 0
  for (const loc of payloadLocations) {
    const raw = loc?.imagePrompt?.trim()
    if (!raw) continue
    const prompt = sanitize(raw)
    const resolvedName = resolveDbLocationName(dbLocationNames, loc?.name)
    if (!resolvedName) continue
    const r = await locationRepository.updateManyActiveImagePromptByProjectAndName(
      projectId,
      resolvedName,
      prompt
    )
    locationPromptWrites += r.count
  }

  return locationPromptWrites
}
