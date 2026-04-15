<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NButton, NSpace, NEmpty, NTag, NSpin,
  NDataTable, NTabs, NTabPane, type DataTableColumns, useMessage
} from 'naive-ui'
import { api } from '@/api'

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

function normalizePipelineListStatus(raw: string | undefined): Job['status'] {
  if (raw === 'running') return 'processing'
  if (raw === 'completed') return 'completed'
  if (raw === 'failed') return 'failed'
  if (raw === 'queued') return 'queued'
  if (raw === 'pending') return 'pending'
  return 'pending'
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
let pollTimer: ReturnType<typeof setInterval> | null = null

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
        return h(NTag, { type: 'info' as const, size: 'small' }, () => pipelineSubtypeLabel(row.jobType))
      }
      const typeMap: Record<string, { type: string; label: string }> = {
        video: { type: 'info', label: '🎬 视频' },
        import: { type: 'warning', label: '📄 导入' },
        image: { type: 'success', label: '🖼️ 图片' }
      }
      const config = typeMap[row.type] || typeMap.video
      return h(NTag, { type: config.type as any, size: 'small' }, () => config.label)
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
        const meta = row.progressMeta && typeof row.progressMeta === 'object' ? row.progressMeta : null
        if (row.jobType === 'episode-storyboard-script' && meta && 'episodeNum' in meta) {
          const n = (meta as { episodeNum?: number }).episodeNum
          return n != null ? `${proj} · 第 ${n} 集` : proj
        }
        const hint =
          meta && 'message' in meta && meta.message ? ` · ${String(meta.message)}` : ''
        return `${proj}${hint}`
      }
      return row.contentPreview || (row.content || '').slice(0, 50) + ((row.content || '').length > 50 ? '...' : '')
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
        if (row.jobType === 'episode-storyboard-script' && row.progressMeta && typeof row.progressMeta === 'object') {
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
          h('span', { style: { color: 'red', fontSize: '12px', title: msg }, title: msg }, shortMsg),
          h(NButton, {
            size: 'tiny',
            quaternary: true,
            onClick: (e: MouseEvent) => { e.stopPropagation(); copyError(msg) }
          }, () => '📋')
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
          return h(NButton, {
            size: 'small',
            type: 'primary',
            onClick: () => router.push(`/project/${row.projectId}/storyboard`)
          }, () => '查看')
        }
      }
      if (row.type === 'image' && row.projectId) {
        return h(NButton, {
          size: 'small',
          type: 'primary',
          onClick: () => router.push(`/project/${row.projectId}/characters`)
        }, () => '查看项目')
      }
      if (row.type === 'import') {
        if (row.status === 'completed' && row.result?.projectId) {
          return h(NButton, {
            size: 'small',
            type: 'primary',
            onClick: () => router.push(`/project/${row.result.projectId}`)
          }, () => '查看项目')
        }
        if (row.status === 'failed') {
          return h(NButton, { size: 'small', onClick: () => handleRetry(row) }, () => '重试')
        }
      }
      return '-'
    }
  }
]

const filteredJobs = computed(() => {
  if (activeTab.value === 'all') return jobs.value
  if (activeTab.value === 'video') return jobs.value.filter(j => j.type === 'video')
  if (activeTab.value === 'import') return jobs.value.filter(j => j.type === 'import')
  if (activeTab.value === 'pipeline') return jobs.value.filter(j => j.type === 'pipeline')
  if (activeTab.value === 'image') return jobs.value.filter(j => j.type === 'image')
  return jobs.value
})

const fetchJobs = async () => {
  isLoading.value = true
  try {
    // 获取导入任务
    const importRes = await api.get('/import/tasks')
    const importJobs: Job[] = (importRes.data.tasks || []).map((t: any) => ({
      id: t.id,
      type: 'import' as const,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      projectId: t.projectId,
      content: t.content,
      contentPreview: (t.content || '').slice(0, 60) + ((t.content || '').length > 60 ? '...' : ''),
      result: t.result,
      errorMsg: t.errorMsg
    }))

    // 获取视频任务（需要项目ID列表）
    const projectRes = await api.get('/projects')
    const projects = projectRes.data.projects || projectRes.data || []
    const projectNameById = new Map<string, string>(
      projects.map((p: { id: string; name: string }) => [p.id, p.name])
    )
    const videoJobs: Job[] = []

    for (const proj of projects) {
      try {
        const tasksRes = await api.get('/tasks', { params: { projectId: proj.id } })
        const tasks = tasksRes.data || []
        for (const t of tasks) {
          videoJobs.push({
            id: t.id,
            type: 'video',
            status: t.status,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            sceneId: t.sceneId,
            sceneNum: t.sceneNum,
            segmentDescription: t.description,
            model: t.model,
            videoUrl: t.videoUrl,
            thumbnailUrl: t.thumbnailUrl,
            cost: t.cost,
            duration: t.duration,
            prompt: t.prompt,
            projectId: proj.id
          })
        }
      } catch (e) {
        // 项目可能没有任务
      }
    }

    // 获取 Pipeline 任务
    const pipelineJobs: Job[] = []
    try {
      const pipelineRes = await api.get('/pipeline/jobs')
      const pipelines = pipelineRes.data || []
      for (const p of pipelines) {
        pipelineJobs.push({
          id: p.id,
          type: 'pipeline',
          status: normalizePipelineListStatus(p.status),
          jobType: p.jobType,
          currentStep: p.currentStep,
          progress: p.progress,
          progressMeta: p.progressMeta,
          projectId: p.projectId,
          projectName: p.projectName,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          errorMsg: p.error
        })
      }
    } catch (e) {
      // 忽略 Pipeline 任务获取错误
    }

    let imageJobs: Job[] = []
    try {
      const imageRes = await api.get('/image-generation/jobs')
      const list = imageRes.data || []
      imageJobs = list.map((j: Record<string, unknown>) => ({
        id: String(j.id),
        type: 'image' as const,
        status: j.status as Job['status'],
        kind: j.kind as string,
        projectId: j.projectId as string,
        projectName: projectNameById.get(j.projectId as string),
        characterId: j.characterId as string | undefined,
        characterImageId: j.characterImageId as string | undefined,
        locationId: j.locationId as string | undefined,
        createdAt: j.createdAt as string,
        updatedAt: j.updatedAt as string,
        errorMsg: j.errorMsg as string | undefined,
        returnvalue: j.returnvalue
      }))
    } catch {
      imageJobs = []
    }

    // 合并并按时间排序
    jobs.value = [...importJobs, ...videoJobs, ...pipelineJobs, ...imageJobs].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  } catch (error) {
    console.error('Failed to fetch jobs:', error)
  } finally {
    isLoading.value = false
  }
}

const handleRetry = (job: Job) => {
  console.log('Retry job:', job.id)
}

const copyError = async (msg: string) => {
  try {
    await navigator.clipboard.writeText(msg)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

const startPolling = () => {
  pollTimer = setInterval(() => {
    const hasProcessing = jobs.value.some(j =>
      j.status === 'pending' || j.status === 'queued' || j.status === 'processing'
    )
    if (hasProcessing) {
      fetchJobs()
    }
  }, 3000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  fetchJobs()
  startPolling()
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
      <NSpace>
        <NButton @click="router.push('/projects')">
          返回项目
        </NButton>
      </NSpace>
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
            <NSpace :size="8">
              <span>🎬 视频</span>
              <NTag v-if="jobs.filter(j => j.type === 'video').length" size="small" round type="info">
                {{ jobs.filter(j => j.type === 'video').length }}
              </NTag>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane name="import" tab="剧本导入">
          <template #tab>
            <NSpace :size="8">
              <span>📄 导入</span>
              <NTag v-if="jobs.filter(j => j.type === 'import').length" size="small" round type="warning">
                {{ jobs.filter(j => j.type === 'import').length }}
              </NTag>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane name="pipeline" tab="Pipeline">
          <template #tab>
            <NSpace :size="8">
              <span>🔄 Pipeline</span>
              <NTag v-if="jobs.filter(j => j.type === 'pipeline').length" size="small" round type="error">
                {{ jobs.filter(j => j.type === 'pipeline').length }}
              </NTag>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane name="image" tab="图片生成">
          <template #tab>
            <NSpace :size="8">
              <span>🖼️ 图片</span>
              <NTag v-if="jobs.filter(j => j.type === 'image').length" size="small" round type="success">
                {{ jobs.filter(j => j.type === 'image').length }}
              </NTag>
            </NSpace>
          </template>
        </NTabPane>
      </NTabs>

      <div class="jobs-content">
        <NSpin :show="isLoading && !jobs.length">
          <NEmpty v-if="!filteredJobs.length && !isLoading" description="暂无任务">
            <template #extra>
              <NButton type="primary" @click="router.push('/projects')">
                去创建项目
              </NButton>
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

      <div v-if="jobs.some(j => j.status === 'processing' || j.status === 'queued')" class="jobs-footer">
        <NTag type="info" size="small">🔄 实时更新中...</NTag>
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
</style>
