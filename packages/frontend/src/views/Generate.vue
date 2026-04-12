<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NResult,
  NInput,
  useMessage
} from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { api, pollPipelineJob, type PipelineJob } from '@/api'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()

const TARGET_EPISODES = 60

const isLoading = ref(true)
const generatingStatus = ref('')
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
const episode1 = computed(() =>
  project.value?.episodes?.find((e: any) => e.episodeNum === 1)
)

const batchProgress = ref<PipelineJob | null>(null)
const isBatching = ref(false)
const isParsing = ref(false)
const showFullEpisode1 = ref(false)
const previewEpisodeNum = ref(1)
const showAllEpisodesPanel = ref(false)

const allEpisodesReady = computed(() => {
  const eps = project.value?.episodes || []
  if (eps.length < TARGET_EPISODES) return false
  for (let n = 1; n <= TARGET_EPISODES; n++) {
    const e = eps.find((x: any) => x.episodeNum === n)
    if (!e || !scenesFromRaw(e.rawScript).length) return false
  }
  return true
})

const previewEpisode = computed(() =>
  (project.value?.episodes || []).find((e: any) => e.episodeNum === previewEpisodeNum.value)
)

function scenesFromRaw(raw: unknown): any[] {
  if (!raw || typeof raw !== 'object') return []
  const s = (raw as any).scenes
  return Array.isArray(s) ? s : []
}

const previewScenes = computed(() => {
  const scenes = scenesFromRaw(episode1.value?.rawScript)
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
}

async function ensureFirstEpisode() {
  const id = projectId.value
  if (!id) return
  const ep = episode1.value as any
  const hasScript = ep?.rawScript && scenesFromRaw(ep.rawScript).length > 0
  if (hasScript) return
  generatingStatus.value = '正在生成第一集剧本…'
  await api.post(`/projects/${id}/episodes/generate-first`, {})
  await loadProject(id)
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
  if (!selectedStyles.value.length) {
    message.warning('请至少选择一种视觉风格')
    return
  }
  await api.put(`/projects/${id}`, { visualStyle: selectedStyles.value })
  isBatching.value = true
  batchProgress.value = null
  try {
    const { data } = await api.post<{ jobId: string }>(`/projects/${id}/episodes/generate-remaining`, {
      targetEpisodes: TARGET_EPISODES
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
    showAllEpisodesPanel.value = true
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
    const { data } = await api.post<{ jobId: string }>(`/projects/${id}/parse`, {
      targetEpisodes: TARGET_EPISODES
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
    await ensureFirstEpisode()
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
</script>

<template>
  <div class="generate-page">
    <template v-if="projectId && !isLoading && !error">
      <div class="generate-toolbar">
        <NButton quaternary @click="handleBack">← 返回项目列表</NButton>
        <h1 class="page-title-inline">生成大纲</h1>
        <NButton size="small" @click="saveDraft">保存草稿</NButton>
      </div>

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

      <NCard class="mt" title="第一集剧本预览">
        <template #header-extra>
          <NSpace>
            <NButton size="tiny" quaternary @click="showFullEpisode1 = !showFullEpisode1">
              {{ showFullEpisode1 ? '收起' : '展开' }}
            </NButton>
          </NSpace>
        </template>
        <div v-if="!episode1 || !scenesFromRaw(episode1.rawScript).length" class="muted">暂无剧本，正在准备…</div>
        <div v-else class="script-preview">
          <div v-for="(sc, idx) in previewScenes" :key="idx" class="scene-block">
            <div class="scene-head">
              Scene {{ sc.sceneNum }}. {{ sc.location }} - {{ sc.timeOfDay }}
            </div>
            <p class="scene-desc">{{ sc.description }}</p>
          </div>
          <p v-if="!showFullEpisode1 && scenesFromRaw(episode1.rawScript).length > 2" class="muted">
            共 {{ scenesFromRaw(episode1.rawScript).length }} 场，点击展开查看全部
          </p>
        </div>
      </NCard>

      <NCard v-if="allEpisodesReady && showAllEpisodesPanel" class="mt" title="全部剧本预览">
        <template #header-extra>
          <NButton size="tiny" quaternary @click="showAllEpisodesPanel = false">收起</NButton>
        </template>
        <div class="episode-picker">
          <span>查看集数：</span>
          <select v-model.number="previewEpisodeNum" class="ep-select">
            <option v-for="n in TARGET_EPISODES" :key="n" :value="n">第 {{ n }} 集</option>
          </select>
        </div>
        <div v-if="previewEpisode" class="script-preview mt-sm">
          <div v-for="(sc, idx) in scenesFromRaw(previewEpisode.rawScript)" :key="idx" class="scene-block">
            <div class="scene-head">
              Scene {{ sc.sceneNum }}. {{ sc.location }} - {{ sc.timeOfDay }}
            </div>
            <p class="scene-desc">{{ sc.description }}</p>
          </div>
        </div>
      </NCard>

      <NCard class="mt" title="剧本生成">
        <p v-if="episode1 && scenesFromRaw(episode1.rawScript).length" class="ok-line">
          第一集已生成。总集数设定：{{ TARGET_EPISODES }} 集。
        </p>
        <p v-if="isBatching && batchProgress?.progressMeta?.message" class="muted">
          {{ batchProgress.progressMeta.message }}
        </p>
        <NSpace class="mt-sm">
          <NButton type="primary" :loading="isBatching" :disabled="isBatching" @click="runBatchRemaining">
            生成剩余 {{ TARGET_EPISODES - 1 }} 集剧本
          </NButton>
          <NButton quaternary :disabled="isBatching">稍后再说</NButton>
        </NSpace>
        <p class="hint">批量生成耗时较长，可离开页面稍后返回查看。</p>
      </NCard>

      <NCard class="mt" title="选择视觉风格（可多选）">
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
        <NButton @click="handleBack">返回修改</NButton>
        <NButton type="primary" size="large" :loading="isParsing" @click="runParse">解析剧本 →</NButton>
      </div>
      <p class="hint center">点击「解析剧本」后，将提取角色、场景并创建形象槽位，完成后进入项目详情页。</p>
    </template>

    <div v-else-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>{{ generatingStatus || '加载中…' }}</p>
    </div>

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
  line-height: 1.7;
}

.scene-block {
  margin-bottom: var(--spacing-md);
}

.scene-head {
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
}

.scene-desc {
  margin: 0;
  color: var(--color-text-secondary);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--spacing-lg);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
