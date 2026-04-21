/**
 * Character image slot processor for visual enrichment
 */

import { characterRepository } from '../../repositories/character-repository.js'
import { buildDerivativePrompt } from './derivative-prompt.js'

interface ParsedCharImage {
  name: string
  type?: string
  description?: string
  prompt?: string
}

interface ParsedCharacter {
  name: string
  images?: ParsedCharImage[]
}

function isDerivedImageType(t: string): t is 'outfit' | 'expression' | 'pose' {
  return t === 'outfit' || t === 'expression' || t === 'pose'
}

function slotProcessOrder(type: string | undefined): number {
  const t = (type || 'base').toLowerCase()
  if (t === 'base') return 0
  return 1
}

function sortCharacterImageSlots(slots: ParsedCharImage[]): ParsedCharImage[] {
  return [...slots].sort((a, b) => slotProcessOrder(a.type) - slotProcessOrder(b.type))
}

/**
 * Process character image slots from AI payload and persist to DB.
 */
export async function processCharacterImageSlots(
  projectId: string,
  payloadCharacters: ParsedCharacter[] | undefined,
  dbCharacters: Awaited<ReturnType<typeof characterRepository.findManyByProjectNameAscWithImages>>
): Promise<void> {
  if (!Array.isArray(payloadCharacters)) return

  for (const pc of payloadCharacters) {
    if (!pc?.name) continue
    const character = dbCharacters.find((c) => c.name === pc.name)
    if (!character) continue

    const images = sortCharacterImageSlots(Array.isArray(pc.images) ? pc.images : [])
    let baseImageId: string | null =
      character.images.find((i) => i.type === 'base' && !i.parentId)?.id || null
    let lastBasePrompt: string | null =
      character.images.find((i) => i.type === 'base' && !i.parentId)?.prompt?.trim() || null

    for (const slot of images) {
      if (!slot?.name || !slot.prompt?.trim()) continue
      const type = (slot.type || 'base').toLowerCase()
      const prompt = slot.prompt.trim()
      const desc = slot.description?.trim() || null

      if (type === 'base') {
        const existingBase = character.images.find((i) => i.type === 'base' && !i.parentId)
        if (existingBase) {
          await characterRepository.updateCharacterImage(existingBase.id, {
            prompt,
            description: desc ?? existingBase.description ?? undefined,
            name: slot.name
          })
          baseImageId = existingBase.id
          lastBasePrompt = prompt
        } else {
          const created = await characterRepository.createCharacterImage({
            characterId: character.id,
            name: slot.name,
            type: 'base',
            description: desc ?? undefined,
            prompt,
            avatarUrl: null,
            order: 0
          })
          baseImageId = created.id
          lastBasePrompt = prompt
          character.images.push(created)
        }
        continue
      }

      if (isDerivedImageType(type)) {
        const parentId =
          baseImageId || character.images.find((i) => i.type === 'base' && !i.parentId)?.id || null
        if (!parentId) continue

        const finalPrompt = buildDerivativePrompt(lastBasePrompt, prompt)
        const maxOrder = await characterRepository.maxSiblingOrder(character.id, parentId)
        const created = await characterRepository.createCharacterImage({
          characterId: character.id,
          name: slot.name,
          parentId,
          type,
          description: desc ?? undefined,
          prompt: finalPrompt,
          avatarUrl: null,
          order: (maxOrder._max.order || 0) + 1
        })
        character.images.push(created)
        if (!baseImageId) baseImageId = parentId
      }
    }
  }
}
