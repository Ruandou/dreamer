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
  useMessage
} from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { api, pollPipelineJob, type PipelineJob } from '@/api'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()

/** 与后端一致：解析可 1–200；批量生成接口要求 2–200 */
const MIN_TARGET_EPISODES = 1
const MAX_TARGET_EPISODES = 200
const DEFAULT_TARGET_EPISODES = 6

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

/** 已有剧本内容的集（批量完成后用于预览，不强制凑满目标集数才显示卡片） */
const episodesWithScript = computed(() => {
  const eps = project.value?.episodes || []
  return [...eps]
    .filter((e: any) => scenesFromRaw(e.rawScript).length > 0)
    .sort((a: any, b: any) => epNum(a) - epNum(b))
})

/** 当前在「剧本预览」中选中的集（多集时以下拉为准，否则为第一集） */
const activePreviewEpisode = computed(() => {
  const eps = episodesWithScript.value
  if (!eps.length) return episode1.value as any
  const match = eps.find((e: any) => epNum(e) === previewEpisodeNum.value)
  return (match || episode1.value) as any
})

const previewCardTitle = computed(() =>
  episodesWithScript.value.length > 1 ? '剧本预览' : '第一集剧本预览'
)

const previewScenes = computed(() => {
  const scenes = scenesFromRaw(activePreviewEpisode.value?.rawScript)
  return showFullEpisode1.value ? scenes : scenes.slice(0, 2)
})

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

async function runBatchRemaining() {
  const id = projectId.value
  if (!id) return
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
    await loadProject(id)
    await nextTick()
    const nums = episodesWithScript.value.map((e: any) => epNum(e))
    if (nums.length && !nums.includes(previewEpisodeNum.value)) {
      previewEpisodeNum.value = Math.min(...nums.filter((n) => n >= 1))
    }
    showFullEpisode1.value = false
  } catch (e: any) {
    message.error(e?.message || '批量生成失败')
  } finally {
    isBatching.value = false
    batchProgress.value = null
  }
}

async function runParse() {
  const id = projectId.value
  if (!id) return
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
  <div class="generate-page">
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

      <NCard class="mt" :title="previewCardTitle">
        <template #header-extra>
          <NSpace align="center" wrap>
            <template v-if="episodesWithScript.length > 1">
              <span class="muted" style="font-size: 12px">第</span>
              <select
                v-model.number="previewEpisodeNum"
                class="ep-select"
                @change="showFullEpisode1 = false"
              >
                <option v-for="ep in episodesWithScript" :key="ep.id" :value="epNum(ep)">
                  {{ epNum(ep) }}
                </option>
              </select>
              <span class="muted" style="font-size: 12px">集</span>
            </template>
            <NButton size="tiny" quaternary @click="showFullEpisode1 = !showFullEpisode1">
              {{ showFullEpisode1 ? '收起' : '展开' }}
            </NButton>
          </NSpace>
        </template>
        <p v-if="episodesWithScript.length > 1 && !allEpisodesReady" class="muted episode-picker">
          当前已生成 {{ episodesWithScript.length }} 集有场次；目标 {{ effectiveTarget }} 集全部就绪后可放心点「解析剧本」。
        </p>
        <div v-if="!activePreviewEpisode || !scenesFromRaw(activePreviewEpisode.rawScript).length" class="muted">
          <p>暂无第一集剧本。从列表进入不会自动生成，请确认创意与梗概后点击下方按钮。</p>
          <NButton
            type="primary"
            class="mt-sm"
            :loading="isGeneratingFirst"
            :disabled="isGeneratingFirst"
            @click="runGenerateFirstEpisode"
          >
            生成第一集剧本
          </NButton>
        </div>
        <div v-else class="script-preview">
          <p v-if="episodesWithScript.length > 1" class="muted" style="margin-bottom: 8px">
            正在预览：第 {{ epNum(activePreviewEpisode) }} 集
          </p>
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
      </NCard>

      <NCard class="mt script-gen-card" title="剧本生成">
        <template #header-extra>
          <div class="episode-count-inline">
            <NTooltip placement="top-end" :delay="200">
              <template #trigger>
                <span class="episode-count-label">总集数</span>
              </template>
              范围 {{ MIN_TARGET_EPISODES }}–{{ MAX_TARGET_EPISODES }}。解析与批量补全均按此数值；仅 1 集时无需批量。
            </NTooltip>
            <NInputNumber
              v-model:value="targetEpisodeCount"
              :min="MIN_TARGET_EPISODES"
              :max="MAX_TARGET_EPISODES"
              :step="1"
              size="small"
              class="episode-count-input"
            />
            <span class="episode-count-unit">集</span>
          </div>
        </template>
        <p v-if="episode1 && scenesFromRaw(episode1.rawScript).length" class="ok-line">
          <template v-if="episodesWithScript.length > 1">
            已生成 {{ episodesWithScript.length }} 集有场次剧本；当前目标 {{ effectiveTarget }} 集。
          </template>
          <template v-else> 第一集已生成。当前目标总集数 {{ effectiveTarget }} 集。 </template>
        </p>
        <p v-if="isBatching && batchProgress?.progressMeta?.message" class="muted">
          {{ batchProgress.progressMeta.message }}
        </p>
        <div class="mt-sm">
          <NButton
            type="primary"
            :loading="isBatching"
            :disabled="
              isBatching ||
              !episode1 ||
              !scenesFromRaw(episode1.rawScript).length ||
              !needsBatchEpisodes
            "
            @click="runBatchRemaining"
          >
            {{
              needsBatchEpisodes
                ? `批量生成至第 ${effectiveTarget} 集`
                : '仅 1 集无需批量'
            }}
          </NButton>
        </div>
        <p class="hint script-gen-hint">批量不依赖视觉风格；耗时可离开页面稍后再看。</p>
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

      <div class="footer-actions mt">
        <NButton type="primary" size="large" :loading="isParsing" @click="runParse">解析剧本 →</NButton>
      </div>
      <p class="hint center">
        解析剧本前须至少选择一种视觉风格；点击后将提取角色、场景并创建形象槽位，完成后进入项目详情页。
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
.generate-page {
  min-height: 100vh;
  padding: var(--spacing-xl);
  background: var(--color-bg-base);
  max-width: 960px;
  margin: 0 auto;
}

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

.ep-select {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-base);
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

.script-gen-card :deep(.n-card-header) {
  padding-bottom: 12px;
}

.episode-count-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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

.script-gen-hint {
  margin-top: 10px;
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
