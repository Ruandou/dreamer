import type { ImageGenerationJobData } from '@dreamer/shared/types'
import { imageQueue } from '../queues/image.js'
import {
  characterImageRepository,
  type CharacterImageRepository
} from '../repositories/character-image-repository.js'
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

export type BatchEnqueueCharacterMissingAvatarResult = {
  enqueued: number
  jobIds: string[]
  enqueuedCharacterImageIds: string[]
  skipped: { id: string; name: string; reason: string }[]
}

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

  /** 对项目内「无定妆图、有提示词、衍生父级已出图」的槽位逐个入队（与单槽 POST generate 规则一致） */
  async batchEnqueueMissingAvatars(
    userId: string,
    projectId: string
  ): Promise<BatchEnqueueCharacterMissingAvatarResult> {
    const rows = await this.repository.findSlotsWithoutAvatarByProject(projectId)
    const jobIds: string[] = []
    const enqueuedCharacterImageIds: string[] = []
    const skipped: { id: string; name: string; reason: string }[] = []

    const slotLabel = (row: (typeof rows)[0]) =>
      `${row.character.name} · ${row.name || '未命名槽位'}`

    for (const row of rows) {
      if (row.avatarUrl?.trim()) {
        skipped.push({ id: row.id, name: slotLabel(row), reason: '已有定妆图' })
        continue
      }
      if (!(row.prompt || '').trim()) {
        skipped.push({ id: row.id, name: slotLabel(row), reason: '缺少提示词' })
        continue
      }
      if (row.parentId && !row.parent?.avatarUrl?.trim()) {
        skipped.push({ id: row.id, name: slotLabel(row), reason: '父级基础形象尚未生成' })
        continue
      }

      const result = await this.enqueueGenerate(userId, row.id)
      if (!result.ok) {
        const reason =
          result.reason === 'missing_prompt'
            ? '缺少提示词'
            : result.reason === 'parent_no_avatar'
              ? '父级基础形象尚未生成'
              : result.reason === 'not_found'
                ? '槽位不存在'
                : '无法入队'
        skipped.push({ id: row.id, name: slotLabel(row), reason })
        continue
      }
      enqueuedCharacterImageIds.push(row.id)
      if (result.jobId != null && result.jobId !== '') {
        jobIds.push(String(result.jobId))
      }
    }

    return {
      enqueued: enqueuedCharacterImageIds.length,
      jobIds,
      enqueuedCharacterImageIds,
      skipped
    }
  }
}

export const characterImageService = new CharacterImageService(characterImageRepository, imageQueue)
