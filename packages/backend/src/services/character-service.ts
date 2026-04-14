import type { CharacterImage, Prisma } from '@prisma/client'
import { uploadFile, generateFileKey } from './storage.js'
import { generateCharacterSlotImagePrompt } from './ai/deepseek.js'
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
  | { ok: false; error: 'base_exists' }
  | { ok: false; error: 'deepseek_auth'; message: string }
  | { ok: false; error: 'deepseek_rate'; message: string }
  | { ok: false; error: 'prompt_failed'; message: string }

export type CreateImageFromUploadedFileResult =
  | { ok: true; image: CharacterImage }
  | { ok: false; error: 'base_exists' }

export type MoveCharacterImageResult =
  | { ok: true; image: CharacterImage }
  | { ok: false; reason: 'circular' }

export type DeleteCharacterImageResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'cannot_delete_base' }

export type UploadCharacterImageAvatarResult =
  | { ok: true; image: CharacterImage }
  | { ok: false; error: 'not_found' | 'invalid_type' }

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
    const slotType = (type || 'base').toLowerCase()

    if (!parentId && slotType === 'base') {
      const n = await this.repository.countRootBaseImages(characterId)
      if (n >= 1) {
        return { ok: false, error: 'base_exists' }
      }
    }

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
  }): Promise<CreateImageFromUploadedFileResult> {
    const { characterId, name, parentId, type, description, fileBuffer, fileMimeType } = params

    const resolvedType = (type || 'base').toLowerCase()
    if (!parentId && resolvedType === 'base') {
      const n = await this.repository.countRootBaseImages(characterId)
      if (n >= 1) {
        return { ok: false, error: 'base_exists' }
      }
    }

    const key = generateFileKey('assets', `upload_${Date.now()}.png`)
    const avatarUrl = await uploadFile('assets', key, fileBuffer, fileMimeType)

    const maxOrder = await this.repository.maxSiblingOrder(characterId, parentId || null)

    const image = await this.repository.createCharacterImage({
      characterId,
      name,
      parentId: parentId || null,
      type: resolvedType,
      description,
      avatarUrl,
      order: (maxOrder._max.order || 0) + 1
    })

    return { ok: true, image: toJsonSafe(image) }
  }

  /** 为已有形象槽位上传/替换定妆图（本地文件 → 对象存储） */
  async uploadAvatarForCharacterImage(
    characterId: string,
    imageId: string,
    fileBuffer: Buffer,
    fileMimeType: string
  ): Promise<UploadCharacterImageAvatarResult> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(fileMimeType)) {
      return { ok: false, error: 'invalid_type' }
    }

    const existing = await this.repository.findCharacterImageById(imageId)
    if (!existing || existing.characterId !== characterId) {
      return { ok: false, error: 'not_found' }
    }

    const key = generateFileKey('assets', `avatar_${Date.now()}.png`)
    const avatarUrl = await uploadFile('assets', key, fileBuffer, fileMimeType)

    const updated = await this.repository.updateCharacterImage(imageId, { avatarUrl })
    return { ok: true, image: toJsonSafe(updated) }
  }

  updateCharacterImage(
    imageId: string,
    data: Prisma.CharacterImageUpdateInput | Prisma.CharacterImageUncheckedUpdateInput
  ) {
    return this.repository.updateCharacterImage(imageId, data)
  }

  async deleteImageWithDescendants(
    characterId: string,
    imageId: string
  ): Promise<DeleteCharacterImageResult> {
    const img = await this.repository.findCharacterImageById(imageId)
    if (!img || img.characterId !== characterId) {
      return { ok: false, error: 'not_found' }
    }
    if (img.type === 'base' && !img.parentId) {
      return { ok: false, error: 'cannot_delete_base' }
    }

    const deleteChildren = async (parentId: string) => {
      const children = await this.repository.findImagesByParentId(parentId)
      for (const child of children) {
        await deleteChildren(child.id)
        await this.repository.deleteCharacterImageById(child.id)
      }
    }
    await deleteChildren(imageId)
    await this.repository.deleteCharacterImageById(imageId)
    return { ok: true }
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
