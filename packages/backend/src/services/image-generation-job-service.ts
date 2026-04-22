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

/** 绑定映射策略：将 job data 转换为 UI binding */
const BINDING_STRATEGIES: Record<
  string,
  ((data: ImageGenerationJobData) => ImageGenerationJobBinding | undefined) | undefined
> = {
  location_establishing: (data) => {
    if (data.kind !== 'location_establishing') return undefined
    const typedData = data as ImageGenerationJobData & {
      kind: 'location_establishing'
      locationId: string
    }
    return {
      kind: 'location',
      locationId: typedData.locationId
    }
  },
  character_base_regenerate: (data) => {
    if (data.kind !== 'character_base_regenerate') return undefined
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_base_regenerate'
      characterImageId: string
    }
    return {
      kind: 'character_image',
      characterImageId: typedData.characterImageId
    }
  },
  character_derived_regenerate: (data) => {
    if (data.kind !== 'character_derived_regenerate') return undefined
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_derived_regenerate'
      characterImageId: string
    }
    return {
      kind: 'character_image',
      characterImageId: typedData.characterImageId
    }
  },
  character_base_create: (data) => {
    if (data.kind !== 'character_base_create') return undefined
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_base_create'
      characterId: string
      name: string
    }
    return {
      kind: 'character_new_image',
      characterId: typedData.characterId,
      createKind: 'character_base_create',
      name: typedData.name
    }
  },
  character_derived_create: (data) => {
    if (data.kind !== 'character_derived_create') return undefined
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_derived_create'
      characterId: string
      name: string
      parentImageId?: string
    }
    return {
      kind: 'character_new_image',
      characterId: typedData.characterId,
      createKind: 'character_derived_create',
      name: typedData.name,
      parentImageId: typedData.parentImageId
    }
  }
}

function bindingFromData(data: ImageGenerationJobData): ImageGenerationJobBinding | undefined {
  const strategy = BINDING_STRATEGIES[data.kind]
  return strategy?.(data)
}

/** 行数据扩展策略：根据 job kind 添加额外字段 */
const ROW_EXTENSION_STRATEGIES: Record<
  string,
  | ((data: ImageGenerationJobData, base: Record<string, unknown>) => ImageGenerationJobRow)
  | undefined
> = {
  location_establishing: (data, base) => {
    if (data.kind !== 'location_establishing') return base as ImageGenerationJobRow
    const typedData = data as ImageGenerationJobData & {
      kind: 'location_establishing'
      locationId: string
    }
    return {
      ...base,
      locationId: typedData.locationId
    } as ImageGenerationJobRow
  },
  character_base_create: (data, base) => {
    if (data.kind !== 'character_base_create') return base as ImageGenerationJobRow
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_base_create'
      characterId: string
    }
    return {
      ...base,
      characterId: typedData.characterId
    } as ImageGenerationJobRow
  },
  character_derived_create: (data, base) => {
    if (data.kind !== 'character_derived_create') return base as ImageGenerationJobRow
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_derived_create'
      characterId: string
    }
    return {
      ...base,
      characterId: typedData.characterId
    } as ImageGenerationJobRow
  },
  character_base_regenerate: (data, base) => {
    if (data.kind !== 'character_base_regenerate') return base as ImageGenerationJobRow
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_base_regenerate'
      characterImageId: string
    }
    return {
      ...base,
      characterImageId: typedData.characterImageId
    } as ImageGenerationJobRow
  },
  character_derived_regenerate: (data, base) => {
    if (data.kind !== 'character_derived_regenerate') return base as ImageGenerationJobRow
    const typedData = data as ImageGenerationJobData & {
      kind: 'character_derived_regenerate'
      characterImageId: string
    }
    return {
      ...base,
      characterImageId: typedData.characterImageId
    } as ImageGenerationJobRow
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

    const extendStrategy = ROW_EXTENSION_STRATEGIES[data.kind]
    rows.push(extendStrategy ? extendStrategy(data, base) : (base as ImageGenerationJobRow))
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return rows
}
