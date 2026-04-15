import { prisma } from '../lib/prisma.js'

export class CharacterShotService {
  async updateCharacterImage(characterShotId: string, characterImageId: string) {
    const row = await prisma.characterShot.findUnique({
      where: { id: characterShotId },
      include: {
        characterImage: { select: { characterId: true } }
      }
    })
    if (!row) {
      return { ok: false as const, reason: 'not_found' as const }
    }

    const next = await prisma.characterImage.findUnique({
      where: { id: characterImageId },
      select: { characterId: true }
    })
    if (!next) {
      return { ok: false as const, reason: 'image_not_found' as const }
    }
    if (next.characterId !== row.characterImage.characterId) {
      return { ok: false as const, reason: 'character_mismatch' as const }
    }

    const updated = await prisma.characterShot.update({
      where: { id: characterShotId },
      data: { characterImageId },
      include: {
        characterImage: {
          include: { character: { select: { id: true, name: true } } }
        }
      }
    })
    return { ok: true as const, characterShot: updated }
  }

  async createForShot(shotId: string, characterImageId: string, action?: string | null) {
    const shot = await prisma.shot.findUnique({
      where: { id: shotId },
      include: {
        scene: {
          include: {
            episode: { select: { projectId: true } }
          }
        }
      }
    })
    if (!shot) {
      return { ok: false as const, reason: 'shot_not_found' as const }
    }

    const img = await prisma.characterImage.findUnique({
      where: { id: characterImageId },
      include: { character: { select: { projectId: true } } }
    })
    if (!img) {
      return { ok: false as const, reason: 'image_not_found' as const }
    }
    if (img.character.projectId !== shot.scene.episode.projectId) {
      return { ok: false as const, reason: 'project_mismatch' as const }
    }

    try {
      const created = await prisma.characterShot.create({
        data: {
          shotId,
          characterImageId,
          ...(action !== undefined && action !== null ? { action } : {})
        },
        include: {
          characterImage: {
            include: { character: { select: { id: true, name: true } } }
          }
        }
      })
      return { ok: true as const, characterShot: created }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
        return { ok: false as const, reason: 'duplicate' as const }
      }
      throw e
    }
  }
}

export const characterShotService = new CharacterShotService()
