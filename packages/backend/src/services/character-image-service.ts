import type { ImageGenerationJobData } from '@dreamer/shared/types'
import { prisma } from '../index.js'
import { imageQueue } from '../queues/image.js'
import { CharacterImageRepository } from '../repositories/character-image-repository.js'
import { buildCharacterImageStyledPrompt } from '../lib/character-image-prompt.js'

export interface ImageQueueAdapter {
  add(
    name: string,
    data: ImageGenerationJobData
  ): Promise<{ id?: string | null }>
}

export type EnqueueCharacterImageGenerateResult =
  | {
      ok: true
      jobId: string | null | undefined
      kind: 'character_base_regenerate' | 'character_derived_regenerate'
    }
  | { ok: false; reason: 'not_found' | 'missing_prompt' | 'parent_no_avatar' }

export class CharacterImageService {
  constructor(
    private readonly repository: CharacterImageRepository,
    private readonly queue: ImageQueueAdapter
  ) {}

  async enqueueGenerate(
    userId: string,
    characterImageId: string,
    bodyPrompt?: string
  ): Promise<EnqueueCharacterImageGenerateResult> {
    const image = await this.repository.findByIdWithCharacterAndParent(characterImageId)
    if (!image) {
      return { ok: false, reason: 'not_found' }
    }

    const project = image.character.project
    let effectivePrompt =
      typeof bodyPrompt === 'string' && bodyPrompt.trim()
        ? bodyPrompt.trim()
        : (image.prompt || '').trim()

    if (bodyPrompt !== undefined && bodyPrompt.trim()) {
      await this.repository.updatePrompt(characterImageId, bodyPrompt.trim())
      effectivePrompt = bodyPrompt.trim()
    }

    if (!effectivePrompt) {
      return { ok: false, reason: 'missing_prompt' }
    }

    const finalPrompt = buildCharacterImageStyledPrompt(project.visualStyle, effectivePrompt)

    if (!image.parentId) {
      const job = await this.queue.add('character-base', {
        kind: 'character_base_regenerate',
        userId,
        projectId: project.id,
        characterImageId: image.id,
        prompt: finalPrompt
      })
      return { ok: true, jobId: job.id, kind: 'character_base_regenerate' }
    }

    const parent = image.parent
    if (!parent?.avatarUrl) {
      return { ok: false, reason: 'parent_no_avatar' }
    }

    const job = await this.queue.add('character-derived', {
      kind: 'character_derived_regenerate',
      userId,
      projectId: project.id,
      characterImageId: image.id,
      referenceImageUrl: parent.avatarUrl,
      editPrompt: finalPrompt
    })
    return { ok: true, jobId: job.id, kind: 'character_derived_regenerate' }
  }
}

export const characterImageRepository = new CharacterImageRepository(prisma)
export const characterImageService = new CharacterImageService(characterImageRepository, imageQueue)
