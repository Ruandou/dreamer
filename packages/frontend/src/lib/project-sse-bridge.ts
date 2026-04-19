/** 与全局 SSE 解耦：useSSE 收到 project-update 后按 projectId 分发给订阅者（如角色库、场地库） */

export type ProjectSsePayload = {
  projectId: string
  type: string
  status?: string
  kind?: string
  characterImageId?: string
  characterId?: string
  locationId?: string
  /** 方舟图片任务完成时的估算成本（元） */
  imageCost?: number | null
  error?: string
  [key: string]: unknown
}

const listeners = new Map<string, Set<(payload: ProjectSsePayload) => void>>()

export function subscribeProjectUpdates(
  projectId: string,
  handler: (payload: ProjectSsePayload) => void
): () => void {
  if (!listeners.has(projectId)) {
    listeners.set(projectId, new Set())
  }
  const projectListeners = listeners.get(projectId)
  if (projectListeners) {
    projectListeners.add(handler)
  }
  return () => {
    const set = listeners.get(projectId)
    if (!set) return
    set.delete(handler)
    if (set.size === 0) listeners.delete(projectId)
  }
}

export function emitProjectUpdateForProject(payload: ProjectSsePayload): void {
  const id = payload.projectId
  if (!id) return
  const set = listeners.get(id)
  if (!set) return
  set.forEach((fn) => {
    try {
      fn(payload)
    } catch (e) {
      console.warn('project SSE listener error', e)
    }
  })
}
