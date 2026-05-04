import { ref, computed, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { api, pollPipelineJob, type PipelineJob } from '@/api'
import type { Episode, ScriptScene } from '@dreamer/shared/types'

const MIN_TARGET_EPISODES = 1
const MAX_TARGET_EPISODES = 200
const DEFAULT_TARGET_EPISODES = 36

export function useGenerateEpisodes() {
  const router = useRouter()
  const route = useRoute()
  const message = useMessage()
  const dialog = useDialog()
  const projectStore = useProjectStore()

  const isLoading = ref(true)
  const generatingStatus = ref('')
  const isGeneratingFirst = ref(false)
  const error = ref<string | null>(null)
  const isBatching = ref(false)
  const isParseOutlineRunning = ref(false)
  const isParsing = ref(false)
  const showFullEpisode = ref(false)
  const previewEpisodeNum = ref(1)
  const targetEpisodeCount = ref(DEFAULT_TARGET_EPISODES)

  const batchProgress = ref<PipelineJob | null>(null)
  const parseOutlineProgress = ref<PipelineJob | null>(null)

  const projectId = computed(() => (route.query.projectId as string) || '')
  const project = computed(() => projectStore.currentProject)

  const EPISODE_PRESETS = [1, 24, 60, 80, 100] as const

  function epNum(e: Episode | undefined): number {
    return Number(e?.episodeNum)
  }

  function scenesFromRaw(raw: unknown): ScriptScene[] {
    let o: unknown = raw
    if (typeof raw === 'string') {
      try {
        o = JSON.parse(raw)
      } catch {
        return []
      }
    }
    if (!o || typeof o !== 'object') return []
    const s = (o as Record<string, unknown>).scenes
    return Array.isArray(s) ? (s as ScriptScene[]) : []
  }

  const episode1 = computed(() => project.value?.episodes?.find((e) => epNum(e) === 1))

  const effectiveTarget = computed(() =>
    Math.max(
      MIN_TARGET_EPISODES,
      Math.min(MAX_TARGET_EPISODES, Math.floor(Number(targetEpisodeCount.value) || 1))
    )
  )

  const allEpisodesReady = computed(() => {
    const te = effectiveTarget.value
    const eps = project.value?.episodes || []
    for (let n = 1; n <= te; n++) {
      const e = eps.find((x) => epNum(x) === n)
      if (!e || !scenesFromRaw(e.script).length) return false
    }
    return true
  })

  const needsBatchEpisodes = computed(() => effectiveTarget.value >= 2)

  const episode1HasScript = computed(
    () => !!episode1.value && scenesFromRaw(episode1.value.script).length > 0
  )

  const batchAllTargetReady = computed(() => needsBatchEpisodes.value && allEpisodesReady.value)

  const batchActionLabel = computed(() => {
    if (!needsBatchEpisodes.value) return '仅 1 集无需批量'
    if (batchAllTargetReady.value) return `目标 ${effectiveTarget.value} 集已全部生成`
    return `批量生成至第 ${effectiveTarget.value} 集`
  })

  const batchButtonDisabled = computed(
    () =>
      isBatching.value ||
      isParsing.value ||
      isParseOutlineRunning.value ||
      isGeneratingFirst.value ||
      !episode1HasScript.value ||
      !needsBatchEpisodes.value ||
      batchAllTargetReady.value
  )

  const episodesWithScript = computed(() => {
    const eps = project.value?.episodes || []
    return [...eps]
      .filter((e) => scenesFromRaw(e.script).length > 0)
      .sort((a, b) => epNum(a) - epNum(b))
  })

  const activePreviewEpisode = computed(() => {
    const eps = episodesWithScript.value
    if (!eps.length) return episode1.value
    const match = eps.find((e) => epNum(e) === previewEpisodeNum.value)
    return match || episode1.value
  })

  const previewScenes = computed(() => {
    const scenes = scenesFromRaw(activePreviewEpisode.value?.script)
    return showFullEpisode.value ? scenes : scenes.slice(0, 2)
  })

  function normalizeTargetInput(v: number | null | undefined): number {
    const n = Math.floor(Number(v) || 1)
    return Math.max(MIN_TARGET_EPISODES, Math.min(MAX_TARGET_EPISODES, n))
  }

  function highestEpisodeNumWithScript(): number {
    const eps = project.value?.episodes || []
    let max = 0
    for (const e of eps) {
      if (scenesFromRaw(e.script).length > 0) {
        const n = epNum(e)
        if (n > max) max = n
      }
    }
    return max
  }

  async function loadProject(id: string) {
    await projectStore.getProject(id)
    const p = projectStore.currentProject
    try {
      const { data } = await api.get<Episode[]>(`/episodes?projectId=${id}`)
      if (p && Array.isArray(data) && data.length > 0) {
        p.episodes = data
      }
    } catch {
      /* keep existing episodes */
    }
  }

  async function saveDraft() {
    const id = projectId.value
    if (!id) return
    await api.put(`/projects/${id}`, {
      description: project.value?.description,
      synopsis: project.value?.synopsis
    })
    message.success('已保存')
    await loadProject(id)
  }

  async function runGenerateFirstEpisode() {
    const id = projectId.value
    if (!id) return
    if (isBatching.value) {
      message.warning('批量生成进行中，请完成后再生成第一集')
      return
    }
    if (isParseOutlineRunning.value) {
      message.warning('解析任务进行中，请完成后再生成第一集')
      return
    }
    const ep = episode1.value
    const hasScript = ep?.script && scenesFromRaw(ep.script).length > 0
    if (hasScript) return
    isGeneratingFirst.value = true
    generatingStatus.value = '正在生成第一集剧本…'
    try {
      await api.post(`/projects/${id}/episodes/generate-first`, {})
      await loadProject(id)

      const updatedEp = episode1.value
      if (updatedEp?.script && scenesFromRaw(updatedEp.script).length > 0) {
        message.success('第一集剧本已生成')
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '生成第一集失败'
      message.error(errMsg)
    } finally {
      isGeneratingFirst.value = false
      generatingStatus.value = ''
    }
  }

  async function afterBatchSuccess(id: string) {
    await loadProject(id)
    await nextTick()
    const nums = episodesWithScript.value.map((e) => epNum(e))
    if (nums.length && !nums.includes(previewEpisodeNum.value)) {
      previewEpisodeNum.value = Math.min(...nums.filter((n) => n >= 1))
    }
    showFullEpisode.value = false
  }

  async function runBatchRemaining() {
    const id = projectId.value
    if (!id) return
    if (isGeneratingFirst.value) {
      message.warning('第一集生成进行中，请完成后再批量生成')
      return
    }
    if (isParseOutlineRunning.value) {
      message.warning('解析任务进行中，请完成后再批量生成')
      return
    }
    const te = Math.max(
      2,
      Math.min(MAX_TARGET_EPISODES, Math.floor(Number(targetEpisodeCount.value) || 2))
    )
    isBatching.value = true
    batchProgress.value = null
    try {
      const { data } = await api.post<{ jobId: string }>(
        `/projects/${id}/episodes/generate-remaining`,
        { targetEpisodes: te }
      )
      await pollPipelineJob(
        data.jobId,
        (j) => {
          batchProgress.value = j
        },
        600000,
        2500
      )
      message.success('剩余集剧本已生成')
      await afterBatchSuccess(id)
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '批量生成失败'
      message.error(errMsg)
    } finally {
      isBatching.value = false
      batchProgress.value = null
    }
  }

  async function resumeOutlineActiveJob(pid: string) {
    let job: PipelineJob | null | undefined
    try {
      const res = await api.get<{ job: PipelineJob | null }>(`/projects/${pid}/outline-active-job`)
      job = res.data?.job
    } catch {
      return
    }
    if (!job) return
    if (job.jobType === 'script-batch') {
      isBatching.value = true
      batchProgress.value = job
      try {
        await pollPipelineJob(
          job.id,
          (j) => {
            batchProgress.value = j
          },
          600000,
          2500
        )
        message.success('剩余集剧本已生成')
        await afterBatchSuccess(pid)
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : '批量生成失败'
        message.error(errMsg)
      } finally {
        isBatching.value = false
        batchProgress.value = null
      }
    } else if (job.jobType === 'parse-script') {
      isParseOutlineRunning.value = true
      parseOutlineProgress.value = job
      try {
        await pollPipelineJob(
          job.id,
          (j) => {
            parseOutlineProgress.value = j
          },
          600000,
          2500
        )
        message.success('解析完成')
        await loadProject(pid)
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : '解析失败'
        message.error(errMsg)
      } finally {
        isParseOutlineRunning.value = false
        parseOutlineProgress.value = null
      }
    } else if (job.jobType === 'script-first') {
      isGeneratingFirst.value = true
      generatingStatus.value = '正在生成第一集剧本…'
      try {
        await pollPipelineJob(job.id, undefined, 600000, 2500)
        message.success('第一集剧本已生成')
        await loadProject(pid)
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : '生成第一集失败'
        message.error(errMsg)
      } finally {
        isGeneratingFirst.value = false
        generatingStatus.value = ''
      }
    }
  }

  async function runParse() {
    const id = projectId.value
    if (!id) return
    if (isParseOutlineRunning.value) {
      message.warning('解析任务进行中')
      return
    }
    if (isGeneratingFirst.value) {
      message.warning('第一集生成进行中，请完成后再解析')
      return
    }
    if (isBatching.value) {
      message.warning('批量生成进行中，请完成后再解析')
      return
    }
    const ep = episode1.value
    if (!ep?.script || scenesFromRaw(ep.script).length === 0) {
      message.warning('请先生成第一集剧本')
      return
    }
    isParsing.value = true
    try {
      const te = Math.max(
        MIN_TARGET_EPISODES,
        Math.min(MAX_TARGET_EPISODES, Math.floor(Number(targetEpisodeCount.value) || 1))
      )
      const { data } = await api.post<{ jobId: string }>(`/projects/${id}/parse`, {
        targetEpisodes: te
      })
      router.push(`/project/${id}?parseJobId=${data.jobId}`)
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '解析失败'
      message.error(errMsg)
    } finally {
      isParsing.value = false
    }
  }

  function onTargetEpisodeUpdate(v: number | null) {
    const next = normalizeTargetInput(v)
    const prev = normalizeTargetInput(targetEpisodeCount.value)
    if (next === prev) return
    if (next > prev) {
      targetEpisodeCount.value = next
      return
    }
    const hi = highestEpisodeNumWithScript()
    if (hi <= next) {
      targetEpisodeCount.value = next
      return
    }
    dialog.warning({
      title: '确认调低总集数？',
      content: `将总集数由 ${prev} 集改为 ${next} 集。解析与批量将按新的目标集数处理；更高集数已生成的剧本仍保留在项目内，不会自动删除。`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => {
        targetEpisodeCount.value = next
      }
    })
  }

  function selectPreviewEpisode(n: number) {
    previewEpisodeNum.value = n
  }

  function handleBack() {
    router.push('/projects')
  }

  function reloadPage() {
    window.location.reload()
  }

  async function onMounted() {
    const pid = (route.query.projectId as string) || ''
    if (!pid) {
      router.replace('/projects')
      isLoading.value = false
      return
    }
    try {
      await loadProject(pid)
      const raw = localStorage.getItem(`dreamer.generate.targetEpisodes.${pid}`)
      if (raw) {
        const n = parseInt(raw, 10)
        if (Number.isFinite(n) && n >= MIN_TARGET_EPISODES && n <= MAX_TARGET_EPISODES) {
          targetEpisodeCount.value = n
        }
      }
      isLoading.value = false
      await resumeOutlineActiveJob(pid)
      const autoGen = route.query.autogen === '1' || route.query.autogen === 'true'
      if (autoGen) {
        await runGenerateFirstEpisode()
        await router.replace({ path: '/generate', query: { projectId: pid } })
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '加载项目失败'
    } finally {
      isLoading.value = false
    }
  }

  // Persist target episode count to localStorage
  watch(targetEpisodeCount, (v) => {
    const id = projectId.value
    if (!id) return
    const n = Math.max(
      MIN_TARGET_EPISODES,
      Math.min(MAX_TARGET_EPISODES, Math.floor(Number(v) || 1))
    )
    localStorage.setItem(`dreamer.generate.targetEpisodes.${id}`, String(n))
  })

  return {
    // State
    isLoading,
    generatingStatus,
    isGeneratingFirst,
    error,
    isBatching,
    isParseOutlineRunning,
    isParsing,
    showFullEpisode,
    previewEpisodeNum,
    targetEpisodeCount,
    batchProgress,
    parseOutlineProgress,
    project,
    projectId,

    // Constants
    MIN_TARGET_EPISODES,
    MAX_TARGET_EPISODES,
    EPISODE_PRESETS,

    // Computed
    effectiveTarget,
    allEpisodesReady,
    needsBatchEpisodes,
    episode1HasScript,
    batchAllTargetReady,
    batchActionLabel,
    batchButtonDisabled,
    episodesWithScript,
    activePreviewEpisode,
    previewScenes,
    episode1,

    // Methods
    scenesFromRaw,
    epNum,
    loadProject,
    saveDraft,
    runGenerateFirstEpisode,
    runBatchRemaining,
    runParse,
    resumeOutlineActiveJob,
    onTargetEpisodeUpdate,
    selectPreviewEpisode,
    handleBack,
    reloadPage,
    onMounted
  }
}
