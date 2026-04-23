<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NEmpty,
  NTag,
  NSpin,
  NDataTable,
  NTabs,
  NTabPane,
  NIcon,
  type DataTableColumns,
  useMessage
} from 'naive-ui'
import {
  VideocamOutline,
  DocumentTextOutline,
  LayersOutline,
  ImageOutline,
  SyncOutline,
  CopyOutline
} from '@vicons/ionicons5'
import { api } from '@/api'
import { usePolling } from '@/composables/usePolling'

const message = useMessage()

// 统一任务类型
interface Job {
  id: string
  type: 'video' | 'import' | 'pipeline' | 'image'
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  // video task fields
  sceneId?: string
  sceneNum?: number
  segmentDescription?: string
  model?: string
  videoUrl?: string
  thumbnailUrl?: string
  cost?: number
  duration?: number
  prompt?: string
  // import task fields
  projectId?: string
  projectName?: string
  content?: string
  contentPreview?: string
  result?: any
  errorMsg?: string
  // pipeline task fields
  jobType?: string
  currentStep?: string
  progress?: number
  progressMeta?: { message?: string } | null
  stepResults?: any[]
  // image-generation (BullMQ) fields
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

const typeTagMap: Record<string, { type: string; label: string; icon: any }> = {
  video: { type: 'info', label: '视频', icon: VideocamOutline },
  import: { type: 'warning', label: '导入', icon: DocumentTextOutline },
  image: { type: 'success', label: '图片', icon: ImageOutline }
}

/** PipelineJob.jobType → 任务中心「类型」列（仅中文，避免与步骤英文 id 混排） */
function pipelineSubtypeLabel(jobType: string | undefined): string {
  const t = (jobType || '').toLowerCase().trim()
  if (t === 'script-first') return '生成第一集'
  if (t === 'script-batch') return '批量剧本'
  if (t === 'parse-script') return '解析剧本'
  if (t === 'episode-storyboard-script') return '分镜剧本'
  if (t === 'full-pipeline') return '完整流水线'
  return 'Pipeline'
}

// 计算任务运行时长
function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime).getTime()
  const end = endTime ? new Date(endTime).getTime() : Date.now()
  const diff = Math.floor((end - start) / 1000)

  if (diff < 60) return `${diff}秒`
  if (diff < 3600) return `${Math.floor(diff / 60)}分${diff % 60}秒`
  return `${Math.floor(diff / 3600)}时${Math.floor((diff % 3600) / 60)}分`
}

const router = useRouter()
const activeTab = ref('all')
const jobs = ref<Job[]>([])
const isLoading = ref(false)

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

const columns: DataTableColumns<Job> = [
  {
    title: '类型',
    key: 'type',
    width: 118,
    render(row) {
      if (row.type === 'pipeline') {
        return h(NTag, { type: 'info' as const, size: 'small' }, () =>
          pipelineSubtypeLabel(row.jobType)
        )
      }
      const config = typeTagMap[row.type] || typeTagMap.video
      return h(NTag, { type: config.type as any, size: 'small' }, () =>
        h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
          h(NIcon, { component: config.icon, size: 12 }),
          config.label
        ])
      )
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      const config = statusMap[row.status] || statusMap.pending
      return h(NTag, { type: config.type as any, size: 'small' }, () => config.label)
    }
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render(row) {
      if (row.type === 'video') {
        return `场景 ${row.sceneNum}: ${(row.prompt || '').slice(0, 50)}${(row.prompt || '').length > 50 ? '...' : ''}`
      }
      if (row.type === 'image') {
        const proj = row.projectName ? `${row.projectName} · ` : ''
        return `${proj}${imageKindLabel(row.kind)}`
      }
      if (row.type === 'pipeline') {
        const proj = row.projectName ? `项目：${row.projectName}` : '未关联项目'
        const meta =
          row.progressMeta && typeof row.progressMeta === 'object' ? row.progressMeta : null
        if (row.jobType === 'episode-storyboard-script' && meta && 'episodeNum' in meta) {
          const n = (meta as { episodeNum?: number }).episodeNum
          return n != null ? `${proj} · 第 ${n} 集` : proj
        }
        const hint = meta && 'message' in meta && meta.message ? ` · ${String(meta.message)}` : ''
        return `${proj}${hint}`
      }
      return (
        row.contentPreview ||
        (row.content || '').slice(0, 50) + ((row.content || '').length > 50 ? '...' : '')
      )
    }
  },
  {
    title: '模型/格式',
    key: 'model',
    width: 100,
    render(row) {
      if (row.type === 'video') {
        return row.model?.toUpperCase() || '-'
      }
      if (row.type === 'image') {
        return imageKindLabel(row.kind)
      }
      if (row.type === 'pipeline') {
        // 该列语义是视频模型 / 导入篇幅；Pipeline 不适用，避免「模型/格式」下出现进度造成误解
        return '-'
      }
      return row.content ? row.content.length + ' 字符' : '-'
    }
  },
  {
    title: '结果',
    key: 'result',
    width: 150,
    render(row) {
      if (row.type === 'video' && row.status === 'completed') {
        return row.cost ? `¥${row.cost.toFixed(4)}` : '-'
      }
      if (row.type === 'image' && row.status === 'completed') {
        const rv = row.returnvalue as { imageCost?: number } | undefined
        const c = rv && typeof rv.imageCost === 'number' ? rv.imageCost : null
        return c != null ? `¥${c.toFixed(4)}` : '已完成'
      }
      if (row.type === 'image' && (row.status === 'processing' || row.status === 'queued')) {
        return '生成中'
      }
      if (row.type === 'import' && row.status === 'completed') {
        const r = row.result || {}
        return `${r.episodesCreated || 0} 集, ${r.charactersCreated || 0} 角色`
      }
      if (row.type === 'pipeline' && row.status === 'completed') {
        if (
          row.jobType === 'episode-storyboard-script' &&
          row.progressMeta &&
          typeof row.progressMeta === 'object'
        ) {
          const m = row.progressMeta as { scenesCreated?: number; aiCost?: number }
          if (m.scenesCreated != null && typeof m.aiCost === 'number') {
            return `${m.scenesCreated} 场 · ¥${m.aiCost.toFixed(4)}`
          }
        }
        return '已完成'
      }
      if (row.type === 'pipeline' && (row.status === 'processing' || row.status === 'pending')) {
        const n = typeof row.progress === 'number' ? row.progress : 0
        return n > 0 ? `进行中（${n}%）` : '进行中'
      }
      if (row.status === 'failed') {
        const msg = row.errorMsg || '未知错误'
        const shortMsg = msg.length > 20 ? msg.slice(0, 20) + '...' : msg
        return h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
          h(
            'span',
            { style: { color: 'red', fontSize: '12px', title: msg }, title: msg },
            shortMsg
          ),
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                copyError(msg)
              }
            },
            () => h(NIcon, { component: CopyOutline, size: 14 })
          )
        ])
      }
      return '-'
    }
  },
  {
    title: '开始时间',
    key: 'createdAt',
    width: 150,
    render(row) {
      return new Date(row.createdAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }
  },
  {
    title: '耗时',
    key: 'duration',
    width: 100,
    render(row) {
      if (row.status === 'completed' || row.status === 'failed') {
        return formatDuration(row.createdAt, row.updatedAt)
      }
      if (row.status === 'processing' || row.status === 'queued' || row.status === 'pending') {
        return h('span', { style: { color: '#18a058' } }, formatDuration(row.createdAt))
      }
      return '-'
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render(row) {
      if (row.type === 'video') {
        if (row.status === 'completed' && row.projectId) {
          return h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              onClick: () => router.push(`/project/${row.projectId}/storyboard`)
            },
            () => '查看'
          )
        }
      }
      if (row.type === 'image' && row.projectId) {
        return h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            onClick: () => router.push(`/project/${row.projectId}/characters`)
          },
          () => '查看项目'
        )
      }
      if (row.type === 'import') {
        if (row.status === 'completed' && row.result?.projectId) {
          return h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              onClick: () => router.push(`/project/${row.result.projectId}`)
            },
            () => '查看项目'
          )
        }
        if (row.status === 'failed') {
          return h(NButton, { size: 'small', onClick: () => handleRetry(row) }, () => '重试')
        }
      }
      return '-'
    }
  }
]

const videoCount = computed(() => jobs.value.filter((j) => j.type === 'video').length)
const importCount = computed(() => jobs.value.filter((j) => j.type === 'import').length)
const pipelineCount = computed(() => jobs.value.filter((j) => j.type === 'pipeline').length)
const imageCount = computed(() => jobs.value.filter((j) => j.type === 'image').length)

const filteredJobs = computed(() => {
  if (activeTab.value === 'all') return jobs.value
  return jobs.value.filter((j) => j.type === activeTab.value)
})

const fetchJobs = async () => {
  isLoading.value = true
  try {
    const res = await api.get('/tasks/all')
    const data = res.data || {}
    const list: Job[] = (data.jobs || []).map((j: any) => ({ ...j }))
    jobs.value = list
  } catch (error) {
    console.error('[Jobs] Failed to fetch jobs:', error)
  } finally {
    isLoading.value = false
  }
}

const handleRetry = (job: Job) => {
  console.info('[Jobs] Retry job:', job.id)
}

const copyError = async (msg: string) => {
  try {
    await navigator.clipboard.writeText(msg)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
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
  <div class="jobs-page page-shell">
    <header class="jobs-header">
      <div>
        <h1>任务中心</h1>
        <p class="jobs-subtitle">查看所有任务进度和历史记录</p>
      </div>
    </header>

    <NCard class="jobs-card">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="all" tab="全部任务">
          <template #tab>
            <NSpace :size="8">
              <span>全部</span>
              <NTag v-if="jobs.length" size="small" round>{{ jobs.length }}</NTag>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane name="video" tab="视频生成">
          <template #tab>
            <NSpace :size="8" align="center">
              <NIcon :component="VideocamOutline" :size="14" />
              <span>视频</span>
              <NTag v-if="videoCount" size="small" round type="info">{{ videoCount }}</NTag>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane name="import" tab="剧本导入">
          <template #tab>
            <NSpace :size="8" align="center">
              <NIcon :component="DocumentTextOutline" :size="14" />
              <span>导入</span>
              <NTag v-if="importCount" size="small" round type="warning">{{ importCount }}</NTag>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane name="pipeline" tab="Pipeline">
          <template #tab>
            <NSpace :size="8" align="center">
              <NIcon :component="LayersOutline" :size="14" />
              <span>Pipeline</span>
              <NTag v-if="pipelineCount" size="small" round type="error">{{ pipelineCount }}</NTag>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane name="image" tab="图片生成">
          <template #tab>
            <NSpace :size="8" align="center">
              <NIcon :component="ImageOutline" :size="14" />
              <span>图片</span>
              <NTag v-if="imageCount" size="small" round type="success">{{ imageCount }}</NTag>
            </NSpace>
          </template>
        </NTabPane>
      </NTabs>

      <div class="jobs-content">
        <NSpin :show="isLoading && !jobs.length">
          <NEmpty v-if="!filteredJobs.length && !isLoading" description="暂无任务">
            <template #extra>
              <NButton type="primary" @click="router.push('/projects')"> 去创建项目 </NButton>
            </template>
          </NEmpty>

          <NDataTable
            v-else
            :columns="columns"
            :data="filteredJobs"
            :loading="isLoading"
            :bordered="false"
            :row-key="(row: Job) => row.id + row.type"
          />
        </NSpin>
      </div>

      <div
        v-if="jobs.some((j) => j.status === 'processing' || j.status === 'queued')"
        class="jobs-footer"
      >
        <NTag type="info" size="small">
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
.jobs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
}

.jobs-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.jobs-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.jobs-card {
  background: var(--color-bg-white);
}

.jobs-content {
  margin-top: var(--spacing-lg);
  min-height: 300px;
}

.jobs-footer {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
  text-align: center;
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
</style>
