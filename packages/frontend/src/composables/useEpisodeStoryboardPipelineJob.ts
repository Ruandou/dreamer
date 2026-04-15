import { ref, watch, onMounted, onUnmounted, type MaybeRefOrGetter, toValue } from 'vue'
import { api } from '@/api'

export type PipelineJobListRow = {
  id: string
  projectId: string
  jobType: string
  status: string
  progressMeta?: unknown
}

const POLL_MS = 2500

/** 从 /pipeline/jobs 列表中筛出：本项目中 episode-storyboard-script 且 pending/running，得到 episodeId -> true */
export function buildRunningStoryboardEpisodeMap(
  jobs: PipelineJobListRow[],
  projectId: string
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const j of jobs) {
    if (j.jobType !== 'episode-storyboard-script') continue
    if (j.projectId !== projectId) continue
    if (j.status !== 'pending' && j.status !== 'running') continue
    const m = j.progressMeta as { episodeId?: string } | undefined
    if (m?.episodeId) out[m.episodeId] = true
  }
  return out
}

/**
 * 轮询当前用户的 PipelineJob，跟踪「AI 分镜剧本」异步任务是否在跑（与任务中心数据源一致）。
 * job 结束（completed/failed）后下一轮轮询会去掉 loading。
 */
export function useEpisodeStoryboardPipelineJob(projectId: MaybeRefOrGetter<string>) {
  const runningByEpisodeId = ref<Record<string, boolean>>({})
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    const pid = toValue(projectId)
    if (!pid) return
    try {
      const res = await api.get<PipelineJobListRow[]>('/pipeline/jobs')
      const jobs = Array.isArray(res.data) ? res.data : []
      runningByEpisodeId.value = buildRunningStoryboardEpisodeMap(jobs, pid)
    } catch {
      // 忽略轮询失败
    }
  }

  function startPolling() {
    if (timer) clearInterval(timer)
    void refresh()
    timer = setInterval(() => {
      void refresh()
    }, POLL_MS)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  watch(
    () => toValue(projectId),
    () => {
      void refresh()
    }
  )

  onMounted(() => {
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
  })

  return { runningByEpisodeId, refresh } as const
}
