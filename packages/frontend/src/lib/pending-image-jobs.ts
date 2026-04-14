import { api } from '@/api'

/** 与后端 GET /image-generation/jobs 的 binding 字段一致 */
export type ImageJobBinding =
  | { kind: 'character_image'; characterImageId: string }
  | { kind: 'location'; locationId: string }
  | {
      kind: 'character_new_image'
      characterId: string
      createKind: 'character_base_create' | 'character_derived_create'
      name?: string
      parentImageId?: string
    }

/** 与后端 image-generation-jobs mapQueueState 一致，表示仍在跑的任务 */
const IN_FLIGHT = new Set(['pending', 'queued', 'processing'])

export type ImageGenJobListItem = {
  id: string
  projectId: string
  status: string
  kind: string
  characterId?: string
  characterImageId?: string
  locationId?: string
  binding?: ImageJobBinding
}

/** 旧版接口无 binding 时，用扁平字段推断（与后端 bindingFromData 对齐） */
export function inferImageJobBinding(j: ImageGenJobListItem): ImageJobBinding | undefined {
  if (j.binding) return j.binding
  if (j.characterImageId) {
    return { kind: 'character_image', characterImageId: j.characterImageId }
  }
  if (j.locationId) {
    return { kind: 'location', locationId: j.locationId }
  }
  if (
    j.characterId &&
    (j.kind === 'character_base_create' || j.kind === 'character_derived_create')
  ) {
    return {
      kind: 'character_new_image',
      characterId: j.characterId,
      createKind: j.kind,
      name: undefined,
      parentImageId: undefined
    }
  }
  return undefined
}

export type InFlightImageJobsForProject = {
  /** 当前项目下仍为进行中的任务（每条对应唯一 Bull job id） */
  jobs: ImageGenJobListItem[]
  /** 形象图槽位 id → 进行中的任务 id（便于与队列一一核对） */
  jobIdsByCharacterImageId: Map<string, string>
  /** 场地 id → 进行中的任务 id */
  jobIdsByLocationId: Map<string, string>
  /** 尚无形象行、仅「新建类」任务可绑定的角色 id */
  characterIdsWithPendingNewImage: Set<string>
  /** 兼容旧 hydrate：仅形象 id 集合 */
  characterImageIds: Set<string>
  locationIds: Set<string>
}

/** 纯函数：便于单测，不发起 HTTP */
export function buildInFlightImageJobsState(
  projectId: string,
  list: ImageGenJobListItem[]
): InFlightImageJobsForProject {
  const jobs = list.filter((j) => j.projectId === projectId && IN_FLIGHT.has(j.status))

  const jobIdsByCharacterImageId = new Map<string, string>()
  const jobIdsByLocationId = new Map<string, string>()
  const characterIdsWithPendingNewImage = new Set<string>()
  const characterImageIds = new Set<string>()
  const locationIds = new Set<string>()

  for (const j of jobs) {
    const b = inferImageJobBinding(j)
    if (!b) continue
    switch (b.kind) {
      case 'character_image':
        jobIdsByCharacterImageId.set(b.characterImageId, j.id)
        characterImageIds.add(b.characterImageId)
        break
      case 'location':
        jobIdsByLocationId.set(b.locationId, j.id)
        locationIds.add(b.locationId)
        break
      case 'character_new_image':
        characterIdsWithPendingNewImage.add(b.characterId)
        break
    }
  }

  return {
    jobs,
    jobIdsByCharacterImageId,
    jobIdsByLocationId,
    characterIdsWithPendingNewImage,
    characterImageIds,
    locationIds
  }
}

/**
 * 拉取当前用户在队列中/处理中的图片生成任务，按项目过滤并按 binding 归类。
 * Bull 任务 id（`jobs[].id`）与队列一一对应；UI 通过 binding 绑定到卡片/槽位。
 */
export async function fetchInFlightImageJobsForProject(
  projectId: string
): Promise<InFlightImageJobsForProject> {
  const res = await api.get<ImageGenJobListItem[]>('/image-generation/jobs')
  return buildInFlightImageJobsState(projectId, res.data || [])
}
