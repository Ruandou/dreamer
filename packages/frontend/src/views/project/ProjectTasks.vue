<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NButton, NSpace, NTag, NIcon, NPagination } from 'naive-ui'
import {
  VideocamOutline,
  DocumentTextOutline,
  LayersOutline,
  ImageOutline,
  SyncOutline
} from '@vicons/ionicons5'
import { api } from '@/api'
import { usePolling } from '@/composables/usePolling'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string

interface Job {
  id: string
  type: 'video' | 'import' | 'pipeline' | 'image'
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  sceneId?: string
  sceneNum?: number
  segmentDescription?: string
  model?: string
  videoUrl?: string
  thumbnailUrl?: string
  cost?: number
  duration?: number
  prompt?: string
  projectId?: string
  projectName?: string
  content?: string
  contentPreview?: string
  result?: { projectId?: string; episodesCreated?: number; charactersCreated?: number }
  errorMsg?: string
  jobType?: string
  currentStep?: string
  progress?: number
  progressMeta?: { message?: string; episodeNum?: number | undefined } | null
  stepResults?: unknown[]
  kind?: string
  characterId?: string
  characterImageId?: string
  locationId?: string
  returnvalue?: unknown
}

function imageKindLabel(kind: string | undefined): string {
  const k = kind || ''
  if (k === 'character_base_create') return '角色·新建定妆'
  if (k === 'character_base_regenerate') return '角色·重生成'
  if (k === 'character_derived_create') return '角色·衍生形象'
  if (k === 'character_derived_regenerate') return '角色·衍生重生成'
  if (k === 'location_establishing') return '场地·定场图'
  return k || '图片'
}

function pipelineSubtypeLabel(jobType: string | undefined): string {
  const t = (jobType || '').toLowerCase().trim()
  if (t === 'script-first') return '生成第一集'
  if (t === 'script-batch') return '批量剧本'
  if (t === 'parse-script') return '解析剧本'
  if (t === 'episode-storyboard-script') return '分镜剧本'
  if (t === 'full-pipeline') return '完整流水线'
  return 'Pipeline'
}

const jobs = ref<Job[]>([])
const isLoading = ref(false)
const page = ref(1)
const pageSize = ref(10)

const hasProcessingJobs = computed(() =>
  jobs.value.some(
    (j) => j.status === 'pending' || j.status === 'queued' || j.status === 'processing'
  )
)

const { start: startPolling, stop: stopPolling } = usePolling(
  async () => {
    await fetchJobs()
    return jobs.value
  },
  {
    interval: 3000,
    shouldContinue: () => hasProcessingJobs.value,
    immediate: false
  }
)

const statusMap: Record<string, { type: string; label: string }> = {
  pending: { type: 'default', label: '等待中' },
  queued: { type: 'warning', label: '排队中' },
  processing: { type: 'info', label: '处理中' },
  completed: { type: 'success', label: '已完成' },
  failed: { type: 'error', label: '失败' }
}

function getJobTypeConfig(type: string, jobType?: string) {
  if (type === 'pipeline') {
    return {
      label: pipelineSubtypeLabel(jobType),
      icon: LayersOutline,
      bgColor: '#ffeaea',
      color: '#e85d55'
    }
  }
  const map: Record<string, any> = {
    video: { label: '视频生成', icon: VideocamOutline, bgColor: '#dbeafe', color: '#2563eb' },
    import: { label: '剧本导入', icon: DocumentTextOutline, bgColor: '#fef3c7', color: '#d97706' },
    image: { label: '图片生成', icon: ImageOutline, bgColor: '#d1fae5', color: '#059669' }
  }
  return map[type] || map.video
}

function getJobDescription(job: Job): string {
  if (job.type === 'video') {
    return `场景 ${job.sceneNum}: ${(job.prompt || '').slice(0, 40)}${(job.prompt || '').length > 40 ? '...' : ''}`
  }
  if (job.type === 'image') {
    return imageKindLabel(job.kind)
  }
  if (job.type === 'pipeline') {
    const meta = job.progressMeta && typeof job.progressMeta === 'object' ? job.progressMeta : null
    if (job.jobType === 'episode-storyboard-script' && meta && 'episodeNum' in meta) {
      const n = (meta as { episodeNum?: number }).episodeNum
      return n != null ? `第 ${n} 集` : ''
    }
    const hint = meta && 'message' in meta && meta.message ? ` · ${String(meta.message)}` : ''
    return `${hint}`
  }
  return (
    job.contentPreview ||
    (job.content || '').slice(0, 40) + ((job.content || '').length > 40 ? '...' : '')
  )
}

function getJobResult(job: Job): string {
  if (job.type === 'video' && job.status === 'completed') {
    return job.cost ? `¥${job.cost.toFixed(4)}` : '已完成'
  }
  if (job.type === 'image' && job.status === 'completed') {
    const rv = job.returnvalue as { imageCost?: number } | undefined
    const c = rv && typeof rv.imageCost === 'number' ? rv.imageCost : null
    return c != null ? `¥${c.toFixed(4)}` : '已完成'
  }
  if (job.type === 'image' && (job.status === 'processing' || job.status === 'queued')) {
    return '生成中...'
  }
  if (job.type === 'import' && job.status === 'completed') {
    const r = job.result || {}
    return `${r.episodesCreated || 0} 集 · ${r.charactersCreated || 0} 角色`
  }
  if (job.type === 'pipeline' && job.status === 'completed') {
    if (
      job.jobType === 'episode-storyboard-script' &&
      job.progressMeta &&
      typeof job.progressMeta === 'object'
    ) {
      const m = job.progressMeta as { scenesCreated?: number; aiCost?: number }
      if (m.scenesCreated != null && typeof m.aiCost === 'number') {
        return `${m.scenesCreated} 场 · ¥${m.aiCost.toFixed(4)}`
      }
    }
    return '已完成'
  }
  if (job.type === 'pipeline' && (job.status === 'processing' || job.status === 'pending')) {
    const n = typeof job.progress === 'number' ? job.progress : 0
    return n > 0 ? `进行中 ${n}%` : '进行中'
  }
  if (job.status === 'failed') {
    return '失败'
  }
  return ''
}

function getJobAction(job: Job): { label: string; handler: () => void } | null {
  if (job.type === 'video' && job.status === 'completed' && job.projectId) {
    return { label: '查看', handler: () => router.push(`/project/${job.projectId}/storyboard`) }
  }
  if (job.type === 'image' && job.projectId) {
    return {
      label: '查看项目',
      handler: () => router.push(`/project/${job.projectId}/characters`)
    }
  }
  if (job.type === 'import' && job.status === 'completed' && job.result?.projectId) {
    return {
      label: '查看项目',
      handler: () => router.push(`/project/${job.result!.projectId}`)
    }
  }
  return null
}

function handleJobClick(job: Job) {
  const action = getJobAction(job)
  if (action) action.handler()
}

function formatTime(date: string) {
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const paginatedJobs = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return jobs.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() => Math.ceil(jobs.value.length / pageSize.value))

watch([page], () => {
  // pagination handled by computed
})

async function fetchJobs() {
  isLoading.value = true
  try {
    const res = await api.get('/tasks/all')
    const data = res.data || {}
    const list = ((data.jobs || []) as Job[]).filter((j) => j.projectId === projectId)
    jobs.value = list
  } catch (error) {
    console.error('[ProjectTasks] Failed to fetch jobs:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchJobs().then(() => {
    if (hasProcessingJobs.value) startPolling()
  })
})

watch(hasProcessingJobs, (has) => {
  if (has) startPolling()
  else stopPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="project-tasks page-shell">
    <h2 class="page-title">项目任务</h2>
    <p class="page-subtitle">当前项目相关的所有任务</p>
    <NCard class="task-card" :bordered="false">
      <div class="task-content">
        <div v-if="isLoading && !jobs.length" class="task-loading">
          <SkeletonLoader variant="table" :rows="5" />
        </div>
        <EmptyState
          v-else-if="!jobs.length"
          title="暂无任务"
          description="当前项目暂无相关任务记录"
          icon="📋"
          :icon-size="48"
          variant="compact"
        />

        <div v-else class="task-card-list">
          <div
            v-for="job in paginatedJobs"
            :key="job.id + job.type"
            class="job-row"
            @click="handleJobClick(job)"
          >
            <div class="job-row__left">
              <div
                class="job-row__icon"
                :style="{
                  background: getJobTypeConfig(job.type, job.jobType).bgColor,
                  color: getJobTypeConfig(job.type, job.jobType).color
                }"
              >
                <NIcon :component="getJobTypeConfig(job.type, job.jobType).icon" :size="18" />
              </div>
              <div class="job-row__info">
                <div class="job-row__title">
                  <span class="job-row__type">{{
                    getJobTypeConfig(job.type, job.jobType).label
                  }}</span>
                  <span class="job-row__desc">{{ getJobDescription(job) }}</span>
                </div>
                <div class="job-row__meta">
                  <NTag
                    :type="(statusMap[job.status]?.type as any) || 'default'"
                    size="small"
                    round
                  >
                    {{ statusMap[job.status]?.label || job.status }}
                  </NTag>
                  <span class="job-row__time">{{ formatTime(job.createdAt) }}</span>
                </div>
              </div>
            </div>
            <div class="job-row__right">
              <span class="job-row__result">{{ getJobResult(job) }}</span>
              <NButton
                v-if="getJobAction(job)"
                size="small"
                type="primary"
                secondary
                @click.stop="getJobAction(job)!.handler()"
              >
                {{ getJobAction(job)!.label }}
              </NButton>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1 || pageSize !== 10" class="task-pagination">
          <NPagination
            v-model:page="page"
            :page-count="totalPages"
            :page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            show-size-picker
            @update:page-size="page = 1"
          />
        </div>
      </div>

      <div
        v-if="jobs.some((j) => j.status === 'processing' || j.status === 'queued')"
        class="task-footer"
      >
        <NTag type="info" size="small" round>
          <NSpace :size="4" align="center">
            <NIcon :component="SyncOutline" :size="12" class="spin-icon" />
            <span>实时更新中...</span>
          </NSpace>
        </NTag>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.project-tasks {
  padding: var(--spacing-lg);
}

.page-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-xs);
}

.page-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
}

.task-card {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
}

.task-content {
  min-height: 200px;
}

.task-loading {
  padding: var(--spacing-xl) 0;
}

.task-card-list {
  display: flex;
  flex-direction: column;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: all 0.2s ease;
}

.job-row:last-child {
  border-bottom: none;
}

.job-row:hover {
  background: var(--color-bg-gray);
}

.job-row__left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.job-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.job-row__info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.job-row__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.job-row__type {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.job-row__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-row__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.job-row__time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.job-row__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.job-row__result {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.task-footer {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
  text-align: center;
}

.task-pagination {
  margin-top: var(--spacing-lg);
  display: flex;
  justify-content: center;
}

.spin-icon {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .job-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .job-row__right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
