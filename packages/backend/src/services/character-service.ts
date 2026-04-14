import type { CharacterImage, Prisma } from '@prisma/client'
import { uploadFile, generateFileKey } from './storage.js'
import { generateCharacterSlotImagePrompt } from './deepseek.js'
import {
  CharacterRepository,
  characterRepository
} from '../repositories/character-repository.js'

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export type CreateImageSlotJsonResult =
  | { ok: true; image: CharacterImage }
  | { ok: false; error: 'invalid_parent' }
  | { ok: false; error: 'deepseek_auth'; message: string }
  | { ok: false; error: 'deepseek_rate'; message: string }
  | { ok: false; error: 'prompt_failed'; message: string }

export type MoveCharacterImageResult =
  | { ok: true; image: CharacterImage }
  | { ok: false; reason: 'circular' }

export class CharacterService {
  constructor(private readonly repository: CharacterRepository) {}

  listByProject(projectId: string) {
    return this.repository.findManyByProjectWithImagesOrdered(projectId)
  }

  getWithImages(characterId: string) {
    return this.repository.findUniqueWithImagesOrdered(characterId)
  }

  createCharacter(projectId: string, name: string, description?: string) {
    return this.repository.createCharacter({
      projectId,
      name,
      ...(description !== undefined ? { description } : {})
    })
  }

  updateCharacter(characterId: string, body: { name?: string; description?: string }) {
    return this.repository.updateCharacter(characterId, body)
  }

  deleteCharacter(characterId: string) {
    return this.repository.deleteCharacter(characterId)
  }

  async createImageSlotWithAiPrompt(
    characterId: string,
    userId: string,
    input: { name: string; type?: string; description?: string; parentId?: string }
  ): Promise<CreateImageSlotJsonResult> {
    const { name, type, description, parentId } = input

    let parentSummary: string | null = null
    if (parentId) {
      const parent = await this.repository.findImageByIdInCharacter(parentId, characterId)
      if (!parent) {
        return { ok: false, error: 'invalid_parent' }
      }
      parentSummary = [parent.name, parent.description].filter(Boolean).join(' — ')
    }

    const character = await this.repository.findCharacterById(characterId)
    const slotType = type || 'base'

    try {
      const { prompt } = await generateCharacterSlotImagePrompt(
        {
          characterName: character?.name || '',
          characterDescription: character?.description,
          slotName: name.trim(),
          slotType,
          slotDescription: description || null,
          parentSlotSummary: parentSummary
        },
        character
          ? {
              userId,
              projectId: character.projectId,
              op: 'character_slot_image_prompt'
            }
          : undefined
      )

      const maxOrder = await this.repository.maxSiblingOrder(characterId, parentId || null)

      const image = await this.repository.createCharacterImage({
        characterId,
        name: name.trim(),
        parentId: parentId || null,
        type: slotType,
        description,
        prompt,
        avatarUrl: null,
        order: (maxOrder._max.order || 0) + 1
      })

      return { ok: true, image: toJsonSafe(image) }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string }
      if (err?.name === 'DeepSeekAuthError') {
        return { ok: false, error: 'deepseek_auth', message: err.message || '' }
      }
      if (err?.name === 'DeepSeekRateLimitError') {
        return { ok: false, error: 'deepseek_rate', message: err.message || '' }
      }
      return {
        ok: false,
        error: 'prompt_failed',
        message: e instanceof Error ? e.message : '未知错误'
      }
    }
  }

  async createImageFromUploadedFile(params: {
    characterId: string
    name: string
    parentId?: string
    type?: string
    description?: string
    fileBuffer: Buffer
    fileMimeType: string
  }): Promise<CharacterImage> {
    const { characterId, name, parentId, type, description, fileBuffer, fileMimeType } = params

    const key = generateFileKey('assets', `upload_${Date.now()}.png`)
    const avatarUrl = await uploadFile('assets', key, fileBuffer, fileMimeType)

    const maxOrder = await this.repository.maxSiblingOrder(characterId, parentId || null)

    const image = await this.repository.createCharacterImage({
      characterId,
      name,
      parentId: parentId || null,
      type: type || 'base',
      description,
      avatarUrl,
      order: (maxOrder._max.order || 0) + 1
    })

    return toJsonSafe(image)
  }

  updateCharacterImage(
    imageId: string,
    data: Prisma.CharacterImageUpdateInput | Prisma.CharacterImageUncheckedUpdateInput
  ) {
    return this.repository.updateCharacterImage(imageId, data)
  }

  async deleteImageWithDescendants(imageId: string): Promise<void> {
    const deleteChildren = async (parentId: string) => {
      const children = await this.repository.findImagesByParentId(parentId)
      for (const child of children) {
        await deleteChildren(child.id)
        await this.repository.deleteCharacterImageById(child.id)
      }
    }
    await deleteChildren(imageId)
    await this.repository.deleteCharacterImageById(imageId)
  }

  /** 将 imageId 移到 parentId 下是否会成环：沿 parentId 向上若遇到 imageId 则非法（与原路由 checkAncestor 一致） */
  private async wouldMoveCreateCycle(imageId: string, newParentId: string): Promise<boolean> {
    let current: string | null = newParentId
    while (current) {
      if (current === imageId) return true
      const img = await this.repository.findCharacterImageById(current)
      current = img?.parentId ?? null
    }
    return false
  }

  async moveCharacterImage(
    characterId: string,
    imageId: string,
    newParentId: string | null | undefined
  ): Promise<MoveCharacterImageResult> {
    const parentId = newParentId || null

    if (parentId) {
      const wouldCycle = await this.wouldMoveCreateCycle(imageId, parentId)
      if (wouldCycle) {
        return { ok: false, reason: 'circular' }
      }
    }

    const maxOrder = await this.repository.maxSiblingOrder(characterId, parentId)

    const image = await this.repository.updateCharacterImage(imageId, {
      parentId,
      order: (maxOrder._max.order || 0) + 1
    } satisfies Prisma.CharacterImageUncheckedUpdateInput)

    return { ok: true, image }
  }
}

export const characterService = new CharacterService(characterRepository)
