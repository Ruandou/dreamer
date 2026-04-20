import { imageQueue } from '../queues/image.js'
import type { ImageGenerationJobData } from '@dreamer/shared/types'

/** 与队列任务 data 一一对应，便于前端精确绑定 UI（形象卡 / 场地卡 / 角色级新建） */
export type ImageGenerationJobBinding =
  | { kind: 'character_image'; characterImageId: string }
  | { kind: 'location'; locationId: string }
  | {
      kind: 'character_new_image'
      characterId: string
      createKind: 'character_base_create' | 'character_derived_create'
      name?: string
      parentImageId?: string
    }

export type ImageGenerationJobRow = {
  id: string
  type: 'image'
  kind: string
  projectId: string
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  errorMsg?: string | null
  characterId?: string
  characterImageId?: string
  locationId?: string
  binding?: ImageGenerationJobBinding
  returnvalue?: unknown
}

function bindingFromData(data: ImageGenerationJobData): ImageGenerationJobBinding | undefined {
  switch (data.kind) {
    case 'location_establishing':
      return { kind: 'location', locationId: data.locationId }
    case 'character_base_regenerate':
    case 'character_derived_regenerate':
      return { kind: 'character_image', characterImageId: data.characterImageId }
    case 'character_base_create':
      return {
        kind: 'character_new_image',
        characterId: data.characterId,
        createKind: 'character_base_create',
        name: data.name
      }
    case 'character_derived_create':
      return {
        kind: 'character_new_image',
        characterId: data.characterId,
        createKind: 'character_derived_create',
        name: data.name,
        parentImageId: data.parentImageId
      }
    default:
      return undefined
  }
}

function inferJobStatus(job: {
  finishedOn?: number | null
  failedReason?: string | null
  processedOn?: number | null
}): ImageGenerationJobRow['status'] {
  if (job.finishedOn) return 'completed'
  if (job.failedReason) return 'failed'
  if (job.processedOn) return 'processing'
  return 'queued'
}

export async function listImageGenerationJobsForUser(
  userId: string
): Promise<ImageGenerationJobRow[]> {
  const types = ['completed', 'failed', 'active', 'waiting', 'delayed', 'paused'] as const
  const rawJobs = await imageQueue.getJobs([...types], 0, 199, false)

  const rows: ImageGenerationJobRow[] = []

  for (const job of rawJobs) {
    const data = job.data as ImageGenerationJobData
    if (!data?.userId || data.userId !== userId) continue

    // 避免对每个 job 调用 getState() 触发额外 Redis 查询
    const status = inferJobStatus(job)
    const createdAt = job.timestamp
      ? new Date(job.timestamp).toISOString()
      : new Date().toISOString()
    const updatedAt = job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : job.processedOn
        ? new Date(job.processedOn).toISOString()
        : createdAt

    const binding = bindingFromData(data)
    const base = {
      id: String(job.id),
      type: 'image' as const,
      kind: data.kind,
      projectId: data.projectId,
      status,
      createdAt,
      updatedAt,
      errorMsg: job.failedReason || null,
      returnvalue: job.returnvalue,
      ...(binding ? { binding } : {})
    }

    switch (data.kind) {
      case 'location_establishing':
        rows.push({ ...base, locationId: data.locationId })
        break
      case 'character_base_create':
        rows.push({ ...base, characterId: data.characterId })
        break
      case 'character_derived_create':
        rows.push({ ...base, characterId: data.characterId })
        break
      case 'character_base_regenerate':
      case 'character_derived_regenerate':
        rows.push({ ...base, characterImageId: data.characterImageId })
        break
      default:
        rows.push(base)
    }
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return rows
}
