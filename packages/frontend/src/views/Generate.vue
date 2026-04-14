<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NResult,
  NInput,
  NInputNumber,
  NSkeleton,
  NSpin,
  NTooltip,
  NScrollbar,
  useMessage,
  useDialog
} from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { api, pollPipelineJob, type PipelineJob } from '@/api'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const dialog = useDialog()
const projectStore = useProjectStore()

/** 与后端一致：解析可 1–200；批量生成接口要求 2–200 */
const MIN_TARGET_EPISODES = 1
const MAX_TARGET_EPISODES = 200
const DEFAULT_TARGET_EPISODES = 36

const isLoading = ref(true)
const generatingStatus = ref('')
const isGeneratingFirst = ref(false)
const selectedStyles = ref<string[]>([])
const error = ref<string | null>(null)

const projectId = computed(() => (route.query.projectId as string) || '')

const styleOptions = [
  { label: '真人写实', value: 'realistic' },
  { label: '电影风格', value: 'cinematic' },
  { label: '动漫风格', value: 'anime' },
  { label: '复古调色', value: 'vintage' }
]

const project = computed(() => projectStore.currentProject as any)

function epNum(e: any): number {
  return Number(e?.episodeNum)
}

function scenesFromRaw(raw: unknown): any[] {
  let o: unknown = raw
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!o || typeof o !== 'object') return []
  const s = (o as any).scenes
  return Array.isArray(s) ? s : []
}

const episode1 = computed(() =>
  project.value?.episodes?.find((e: any) => epNum(e) === 1)
)

const batchProgress = ref<PipelineJob | null>(null)
const isBatching = ref(false)
/** 刷新后恢复的「解析剧本」异步任务（与批量互斥） */
const isParseOutlineRunning = ref(false)
const parseOutlineProgress = ref<PipelineJob | null>(null)
const isParsing = ref(false)
const showFullEpisode1 = ref(false)
const previewEpisodeNum = ref(1)

/** 目标总集数（用户可调，按项目记住） */
const targetEpisodeCount = ref(DEFAULT_TARGET_EPISODES)

/** 展示与校验用的规范目标集数 */
const effectiveTarget = computed(() =>
  Math.max(
    MIN_TARGET_EPISODES,
    Math.min(MAX_TARGET_EPISODES, Math.floor(Number(targetEpisodeCount.value) || 1))
  )
)

/** 第 1..目标集数 是否均有可预览的 scenes（提示用） */
const allEpisodesReady = computed(() => {
  const te = effectiveTarget.value
  const eps = project.value?.episodes || []
  for (let n = 1; n <= te; n++) {
    const e = eps.find((x: any) => epNum(x) === n)
    if (!e || !scenesFromRaw(e.rawScript).length) return false
  }
  return true
})

/** 是否需要批量生成（总集数 ≥2 才有第 2 集及以后） */
const needsBatchEpisodes = computed(() => effectiveTarget.value >= 2)

/** 第一集已有可预览剧本（批量入口的前置条件） */
const episode1HasScript = computed(
  () => !!episode1.value && scenesFromRaw(episode1.value.rawScript).length > 0
)

/** 目标 2..N 集是否已全部就绪（批量按钮应显示完成态，不再强调「去生成」） */
const batchAllTargetReady = computed(
  () => needsBatchEpisodes.value && allEpisodesReady.value
)

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

/** 总集数快捷预设（短剧常见 50–100 集量级，大盘均值约 70–80 集/部，见行业数据报道） */
const EPISODE_PRESETS = [1, 24, 60, 80, 100] as const

function normalizeTargetInput(v: number | null | undefined): number {
  const n = Math.floor(Number(v) || 1)
  return Math.max(
    MIN_TARGET_EPISODES,
    Math.min(MAX_TARGET_EPISODES, n)
  )
}

/** 当前项目中已有场次剧本的最高集号；无则 0 */
function highestEpisodeNumWithScript(): number {
  const eps = project.value?.episodes || []
  let max = 0
  for (const e of eps) {
    if (scenesFromRaw((e as any).rawScript).length > 0) {
      const n = epNum(e)
      if (n > max) max = n
    }
  }
  return max
}

/** 调高直接生效；调低时仅当会「裁到」已有高集剧本时才二次确认 */
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

/** 已有剧本内容的集（批量完成后用于预览，不强制凑满目标集数才显示卡片） */
const episodesWithScript = computed(() => {
  const eps = project.value?.episodes || []
  return [...eps]
    .filter((e: any) => scenesFromRaw(e.rawScript).length > 0)
    .sort((a: any, b: any) => epNum(a) - epNum(b))
})

/** 当前在「剧本预览」中选中的集（多集时以左侧 Tab 为准） */
const activePreviewEpisode = computed(() => {
  const eps = episodesWithScript.value
  if (!eps.length) return episode1.value as any
  const match = eps.find((e: any) => epNum(e) === previewEpisodeNum.value)
  return (match || episode1.value) as any
})

const previewScenes = computed(() => {
  const scenes = scenesFromRaw(activePreviewEpisode.value?.rawScript)
  return showFullEpisode1.value ? scenes : scenes.slice(0, 2)
})

function selectPreviewEpisode(n: number) {
  previewEpisodeNum.value = n
}

function toggleStyle(val: string) {
  const i = selectedStyles.value.indexOf(val)
  if (i === -1) selectedStyles.value = [...selectedStyles.value, val]
  else selectedStyles.value = selectedStyles.value.filter((v) => v !== val)
}

function styleActive(val: string) {
  return selectedStyles.value.includes(val)
}

async function loadProject(id: string) {
  await projectStore.getProject(id)
  const p = projectStore.currentProject as any
  if (p?.visualStyle?.length) selectedStyles.value = [...p.visualStyle]
  else selectedStyles.value = []
  // 项目详情接口偶发只带部分 episodes；列表接口保证拉全部分集与 rawScript
  try {
    const { data } = await api.get<any[]>(`/episodes?projectId=${id}`)
    if (p && Array.isArray(data) && data.length > 0) {
      p.episodes = data
    }
  } catch {
    /* 保留 getProject 自带的 episodes */
  }
}

/** 仅用户点击「生成第一集」或 URL 带 autogen=1（快速创建）时调用，进入页面不自动请求 */
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
  const ep = episode1.value as any
  const hasScript = ep?.rawScript && scenesFromRaw(ep.rawScript).length > 0
  if (hasScript) return
  isGeneratingFirst.value = true
  generatingStatus.value = '正在生成第一集剧本…'
  try {
    await api.post(`/projects/${id}/episodes/generate-first`, {})
    await loadProject(id)
    message.success('第一集剧本已生成')
  } catch (e: any) {
    message.error(e?.message || '生成第一集失败')
  } finally {
    isGeneratingFirst.value = false
    generatingStatus.value = ''
  }
}

async function saveDraft() {
  const id = projectId.value
  if (!id) return
  await api.put(`/projects/${id}`, {
    description: (project.value as any)?.description,
    synopsis: (project.value as any)?.synopsis,
    visualStyle: selectedStyles.value
  })
  message.success('已保存')
  await loadProject(id)
}

async function afterBatchSuccess(id: string) {
  await loadProject(id)
  await nextTick()
  const nums = episodesWithScript.value.map((e: any) => epNum(e))
  if (nums.length && !nums.includes(previewEpisodeNum.value)) {
    previewEpisodeNum.value = Math.min(...nums.filter((n) => n >= 1))
  }
  showFullEpisode1.value = false
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
    const { data } = await api.post<{ jobId: string }>(`/projects/${id}/episodes/generate-remaining`, {
      targetEpisodes: te
    })
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
  } catch (e: any) {
    message.error(e?.message || '批量生成失败')
  } finally {
    isBatching.value = false
    batchProgress.value = null
  }
}

/** 刷新页面后：若仍有进行中的批量/解析任务，恢复轮询与按钮互斥 */
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
    } catch (e: any) {
      message.error(e?.message || '批量生成失败')
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
    } catch (e: any) {
      message.error(e?.message || '解析失败')
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
    } catch (e: any) {
      message.error(e?.message || '生成第一集失败')
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
  if (!selectedStyles.value.length) {
    message.warning('请至少选择一种视觉风格')
    return
  }
  const ep = episode1.value as any
  if (!ep?.rawScript || scenesFromRaw(ep.rawScript).length === 0) {
    message.warning('请先生成第一集剧本')
    return
  }
  await api.put(`/projects/${id}`, { visualStyle: selectedStyles.value })
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
  } catch (e: any) {
    message.error(e?.response?.data?.error || e?.message || '解析失败')
  } finally {
    isParsing.value = false
  }
}

onMounted(async () => {
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
    // 须在长轮询 resumeOutlineActiveJob 之前结束骨架屏，否则批量进行中刷新会一直看不到创意/梗概
    isLoading.value = false
    await resumeOutlineActiveJob(pid)
    const autoGen =
      route.query.autogen === '1' ||
      route.query.autogen === 'true'
    if (autoGen) {
      await runGenerateFirstEpisode()
      await router.replace({ path: '/generate', query: { projectId: pid } })
    }
  } catch (e: any) {
    error.value = e?.message || '加载项目失败'
  } finally {
    isLoading.value = false
  }
})

const handleBack = () => {
  router.push('/projects')
}

function reloadPage() {
  window.location.reload()
}

watch(targetEpisodeCount, (v) => {
  const id = projectId.value
  if (!id) return
  const n = Math.max(
    MIN_TARGET_EPISODES,
    Math.min(MAX_TARGET_EPISODES, Math.floor(Number(v) || 1))
  )
  localStorage.setItem(`dreamer.generate.targetEpisodes.${id}`, String(n))
})
</script>

<template>
  <div class="generate-page page-shell">
    <template v-if="projectId && !error">
      <div class="generate-toolbar">
        <NButton quaternary @click="handleBack">← 返回项目列表</NButton>
        <h1 class="page-title-inline">生成大纲</h1>
        <NButton size="small" :disabled="isLoading" @click="saveDraft">保存草稿</NButton>
      </div>

      <!-- 骨架：进入页面即见布局，避免全屏转圈 -->
      <template v-if="isLoading">
        <div class="loading-bar" role="status" aria-live="polite">
          <NSpin size="small" />
          <span>{{ generatingStatus || '正在加载项目…' }}</span>
        </div>
        <div class="two-col">
          <NCard title="故事创意">
            <NSkeleton text :repeat="6" />
          </NCard>
          <NCard title="故事梗概">
            <NSkeleton text :repeat="6" />
          </NCard>
        </div>
        <NCard class="mt" title="剧本预览">
          <NSkeleton text :repeat="8" />
        </NCard>
        <NCard class="mt" title="剧本生成">
          <NSkeleton height="34px" width="220px" round />
        </NCard>
        <NCard class="mt" title="选择视觉风格">
          <div class="style-list">
            <NSkeleton v-for="i in 4" :key="i" height="44px" width="96px" round />
          </div>
        </NCard>
        <div class="footer-actions mt">
          <NSkeleton height="34px" width="88px" round />
          <NSkeleton height="40px" width="120px" round />
        </div>
      </template>

      <template v-else>
      <div class="two-col">
        <NCard title="故事创意">
          <NInput
            type="textarea"
            :rows="6"
            :value="(project as any)?.description || ''"
            placeholder="一句话描述你的故事"
            @update:value="(v) => ((projectStore.currentProject as any).description = v)"
          />
        </NCard>
        <NCard title="故事梗概">
          <NInput
            type="textarea"
            :rows="6"
            :value="(project as any)?.synopsis || ''"
            placeholder="梗概"
            @update:value="(v) => ((projectStore.currentProject as any).synopsis = v)"
          />
        </NCard>
      </div>

      <NCard class="mt preview-script-card" title="剧本预览">
        <template #header-extra>
          <NButton
            v-if="activePreviewEpisode && scenesFromRaw(activePreviewEpisode.rawScript).length"
            size="tiny"
            quaternary
            @click="showFullEpisode1 = !showFullEpisode1"
          >
            {{ showFullEpisode1 ? '收起' : '展开' }}
          </NButton>
        </template>
        <p
          v-if="episodesWithScript.length > 1 && needsBatchEpisodes && allEpisodesReady"
          class="episode-picker episode-picker--ok"
        >
          目标 {{ effectiveTarget }} 集均已就绪，可前往下方「解析剧本」。
        </p>
        <p
          v-else-if="episodesWithScript.length > 1 && !allEpisodesReady"
          class="muted episode-picker"
        >
          当前已生成 {{ episodesWithScript.length }} 集有场次；凑满目标 {{ effectiveTarget }} 集后再解析更稳妥。
        </p>
        <div v-if="!activePreviewEpisode || !scenesFromRaw(activePreviewEpisode.rawScript).length" class="muted">
          <p>暂无第一集剧本。从列表进入不会自动生成，请确认创意与梗概后点击下方按钮。</p>
          <NButton
            type="primary"
            class="mt-sm"
            :loading="isGeneratingFirst"
            :disabled="isGeneratingFirst || isBatching || isParseOutlineRunning"
            @click="runGenerateFirstEpisode"
          >
            生成第一集剧本
          </NButton>
        </div>
        <div v-else class="script-preview-outer">
          <div class="preview-split">
            <div class="preview-ep-tablist-wrap">
              <NScrollbar class="preview-tab-scroll" trigger="hover">
                <nav
                  class="preview-ep-tablist-inner"
                  role="tablist"
                  aria-label="选择预览集数"
                >
                  <button
                    v-for="ep in episodesWithScript"
                    :key="ep.id"
                    type="button"
                    role="tab"
                    class="preview-ep-tab"
                    :class="{ 'preview-ep-tab--active': epNum(ep) === previewEpisodeNum }"
                    :aria-selected="epNum(ep) === previewEpisodeNum"
                    @click="selectPreviewEpisode(epNum(ep))"
                  >
                    第 {{ epNum(ep) }} 集
                  </button>
                </nav>
              </NScrollbar>
            </div>
            <div class="preview-ep-panel">
              <p v-if="(activePreviewEpisode as any)?.title" class="preview-ep-title">
                {{ (activePreviewEpisode as any).title }}
              </p>
              <div class="preview-scroll-wrap">
                <div class="script-preview">
                  <div v-for="(sc, idx) in previewScenes" :key="idx" class="scene-block">
                    <div class="scene-head">
                      Scene {{ sc.sceneNum }}. {{ sc.location }} - {{ sc.timeOfDay }}
                    </div>
                    <p class="scene-desc">{{ sc.description }}</p>
                  </div>
                  <p
                    v-if="!showFullEpisode1 && scenesFromRaw(activePreviewEpisode.rawScript).length > 2"
                    class="expand-hint muted"
                  >
                    共 {{ scenesFromRaw(activePreviewEpisode.rawScript).length }} 场，
                    <NButton text type="primary" size="tiny" @click="showFullEpisode1 = true">
                      展开查看全部
                    </NButton>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </NCard>

      <NCard class="mt script-gen-card" title="剧本生成">
        <div class="episode-count-row">
          <div class="episode-count-inline">
            <NTooltip placement="top-start" :delay="200">
              <template #trigger>
                <span class="episode-count-label">总集数</span>
              </template>
              范围 {{ MIN_TARGET_EPISODES }}–{{ MAX_TARGET_EPISODES }}。解析与批量补全均按此数值；仅 1 集时无需批量。
            </NTooltip>
            <NInputNumber
              :value="targetEpisodeCount"
              :min="MIN_TARGET_EPISODES"
              :max="MAX_TARGET_EPISODES"
              :step="1"
              size="small"
              class="episode-count-input"
              @update:value="onTargetEpisodeUpdate"
            />
            <span class="episode-count-unit">集</span>
          </div>
        </div>
        <div class="episode-presets">
          <span class="episode-presets-label">快捷</span>
          <NButton
            v-for="n in EPISODE_PRESETS"
            :key="n"
            size="tiny"
            :type="effectiveTarget === n ? 'primary' : 'default'"
            quaternary
            @click="onTargetEpisodeUpdate(n)"
          >
            {{ n }}
          </NButton>
        </div>
        <p
          v-if="episode1HasScript && !isBatching && !isParseOutlineRunning && !isGeneratingFirst"
          class="ok-line"
        >
          <template v-if="batchAllTargetReady">
            目标 {{ effectiveTarget }} 集剧本已全部生成，可直接解析或微调总集数后再次补全。
          </template>
          <template v-else-if="episodesWithScript.length > 1">
            已生成 {{ episodesWithScript.length }}/{{ effectiveTarget }} 集，点击⬇️可批量补全
          </template>
          <template v-else>
            第一集已生成；目标 {{ effectiveTarget }} 集{{ needsBatchEpisodes ? '，其余集请点下方批量。' : '。' }}
          </template>
        </p>
        <p v-if="isBatching && batchProgress?.progressMeta?.message" class="muted">
          {{ batchProgress.progressMeta.message }}
        </p>
        <div class="mt-sm">
          <NButton
            :type="batchAllTargetReady ? 'success' : 'primary'"
            :loading="isBatching"
            :disabled="batchButtonDisabled"
            @click="runBatchRemaining"
          >
            {{ batchActionLabel }}
          </NButton>
        </div>
        <p
          v-if="needsBatchEpisodes && episode1HasScript && !batchAllTargetReady"
          class="hint"
        >
          批量生成较耗时，后台执行；可离开，稍后在任务中心看进度。
        </p>
      </NCard>

      <NCard class="mt" title="选择视觉风格（解析剧本前必选，可多选）">
        <div class="style-list">
          <div
            v-for="opt in styleOptions"
            :key="opt.value"
            class="style-item"
            :class="{ active: styleActive(opt.value) }"
            @click="toggleStyle(opt.value)"
          >
            {{ opt.label }}
          </div>
        </div>
      </NCard>

      <div class="footer-parse mt">
        <NButton
          type="primary"
          size="large"
          :loading="isParsing || isParseOutlineRunning"
          :disabled="isBatching || isParseOutlineRunning || isGeneratingFirst"
          @click="runParse"
        >
          解析剧本 →
        </NButton>
        <p class="footer-parse-sub">
          <template v-if="isBatching">批量生成进行中，请完成后再解析。</template>
          <template v-else-if="isGeneratingFirst">第一集生成进行中，请完成后再解析。</template>
          <template v-else-if="isParseOutlineRunning">解析任务进行中，请稍候。</template>
          <template v-else>
            将按当前总集数处理前 {{ effectiveTarget }} 集（含自动补全缺失剧本）；须先选视觉风格。
          </template>
        </p>
      </div>
      <p class="hint center">
        提取角色、场景与形象槽位，完成后进入项目详情。
      </p>
      </template>
    </template>

    <NCard v-else-if="error" class="error-card">
      <NResult status="error" title="生成失败" :description="error">
        <template #footer>
          <NSpace>
            <NButton @click="handleBack">返回</NButton>
            <NButton type="primary" @click="reloadPage">重试</NButton>
          </NSpace>
        </template>
      </NResult>
    </NCard>
  </div>
</template>

<style scoped>
.generate-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.page-title-inline {
  margin: 0;
  font-size: var(--font-size-xl);
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

@media (max-width: 768px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

.mt {
  margin-top: var(--spacing-md);
}

.mt-sm {
  margin-top: var(--spacing-sm);
}

.ok-line {
  color: var(--color-success, #18a058);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-sm);
}

.hint.center {
  text-align: center;
}

.episode-picker {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.episode-picker--ok {
  color: var(--color-success, #18a058);
  font-weight: 500;
}

.script-preview-outer {
  min-height: 0;
}

.preview-split {
  --preview-pane-max: min(58vh, 560px);
  /* 与 pane 同 cap；子项用 calc(…- title) 避免 :has() 高特异性在移动端压过 @media */
  --preview-scroll-max: min(58vh, 560px);
  display: flex;
  gap: 14px;
  /* flex-start：避免左侧集数很多时把右侧矮内容强行拉高留白；左右各自 max-height + 内部滚动 */
  align-items: flex-start;
  min-height: 0;
}

.preview-ep-tablist-wrap {
  flex-shrink: 0;
  width: 122px;
  min-height: 0;
  max-height: var(--preview-pane-max);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview-tab-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 10px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.preview-tab-scroll :deep(.n-scrollbar-container) {
  border-radius: 10px;
}

.preview-ep-tablist-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  box-sizing: border-box;
}

.preview-ep-tab {
  width: 100%;
  margin: 0;
  padding: 10px 10px;
  text-align: left;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.3;
  color: #6b7280;
  transition: background 0.15s ease, color 0.15s ease;
  font-family: inherit;
}

.preview-ep-tab:hover {
  background: #e5e7eb;
  color: #111827;
}

.preview-ep-tab--active {
  background: #6366f1;
  color: #fff;
  font-weight: 600;
}

.preview-ep-tab--active:hover {
  background: #4f46e5;
  color: #fff;
}

.preview-ep-panel {
  --preview-title-offset: 0px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-height: var(--preview-pane-max);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-ep-panel:has(.preview-ep-title) {
  --preview-title-offset: 48px;
}

.preview-ep-title {
  flex-shrink: 0;
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

/* 原生滚动：用 max-height 收敛高度，不用 flex:1，避免与「内容撑开父级」互相拉扯 */
.preview-scroll-wrap {
  flex: 0 1 auto;
  min-height: 0;
  max-height: calc(var(--preview-scroll-max) - var(--preview-title-offset));
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  border-radius: 12px;
}

/* NCard 内容区参与 flex 链时默认 min-height:auto，会阻止子项在 max-height 内滚动 */
.preview-script-card :deep(.n-card__content) {
  min-height: 0;
}

@media (max-width: 640px) {
  .preview-split {
    flex-direction: column;
    --preview-pane-max: min(50vh, 480px);
    --preview-scroll-max: min(50vh, 480px);
    --preview-pane-min: 0;
    height: auto;
    min-height: 0;
    max-height: none;
    overflow: visible;
  }

  .preview-ep-tablist-wrap {
    width: 100%;
    height: auto;
    min-height: 0;
    max-height: 112px;
  }

  .preview-tab-scroll {
    max-height: 112px;
  }

  .preview-ep-tablist-inner {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .preview-ep-tab {
    width: auto;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .preview-ep-panel {
    height: auto;
    min-height: 0;
    max-height: none;
  }

  .preview-scroll-wrap {
    flex: 0 1 auto;
    min-height: 220px;
  }
}

.muted {
  color: var(--color-text-tertiary);
}

.script-preview {
  line-height: 1.65;
  font-size: 14px;
  padding: var(--spacing-md);
  border-radius: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.scene-block {
  margin-bottom: var(--spacing-md);
  padding: 14px 16px 14px 18px;
  background: #fff;
  border-radius: 10px;
  border-left: 3px solid #6366f1;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.scene-block:last-child {
  margin-bottom: 0;
}

.scene-head {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.scene-desc {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
}

.expand-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  margin-bottom: 0;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.episode-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.episode-presets-label {
  font-size: 12px;
  color: #9ca3af;
  margin-right: 4px;
}

.footer-parse {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
}

.footer-parse-sub {
  margin: 0;
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
  text-align: right;
}

.script-gen-card :deep(.n-card-header) {
  padding-bottom: 12px;
}

.episode-count-row {
  margin-bottom: 12px;
}

.episode-count-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  justify-content: flex-start;
}

.episode-count-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: default;
}

.episode-count-input {
  width: 100px;
}

.episode-count-unit {
  font-size: 13px;
  color: #9ca3af;
  user-select: none;
}

.loading-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.error-card {
  max-width: 480px;
  margin: 100px auto;
}

.style-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.style-item {
  padding: var(--spacing-md) var(--spacing-xl);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.style-item:hover {
  border-color: var(--color-primary);
}

.style-item.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
</style>
