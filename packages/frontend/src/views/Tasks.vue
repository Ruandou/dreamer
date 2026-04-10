<script setup lang="ts">
import { ref, onMounted, onUnmounted, h } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NButton, NSpace, NEmpty, NTag, NSpin,
  NDataTable, type DataTableColumns
} from 'naive-ui'
import { api } from '@/api'

interface ImportTask {
  id: string
  projectId: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  content: string
  type: string
  result: any
  errorMsg: string | null
  createdAt: string
  updatedAt: string
}

const router = useRouter()
const tasks = ref<ImportTask[]>([])
const isLoading = ref(false)
const pagination = ref({ page: 1, pageSize: 20, total: 0 })
let pollTimer: ReturnType<typeof setInterval> | null = null

const statusMap: Record<string, { type: string; label: string }> = {
  pending: { type: 'default', label: '等待中' },
  processing: { type: 'info', label: '处理中' },
  completed: { type: 'success', label: '已完成' },
  failed: { type: 'error', label: '失败' }
}

const columns: DataTableColumns<ImportTask> = [
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
    title: '格式',
    key: 'type',
    width: 80,
    render(row) {
      return h(NTag, { size: 'small', bordered: false }, () => row.type.toUpperCase())
    }
  },
  {
    title: '内容预览',
    key: 'content',
    ellipsis: { tooltip: true },
    render(row) {
      const preview = row.content.slice(0, 60) + (row.content.length > 60 ? '...' : '')
      return preview || '-'
    }
  },
  {
    title: '结果',
    key: 'result',
    render(row) {
      if (row.status === 'completed' && row.result) {
        const r = row.result
        return `${r.episodesCreated || 0} 集, ${r.charactersCreated || 0} 角色`
      }
      if (row.status === 'failed') {
        return h('span', { style: { color: 'red' } }, row.errorMsg || '未知错误')
      }
      return '-'
    }
  },
  {
    title: '时间',
    key: 'createdAt',
    width: 160,
    render(row) {
      return new Date(row.createdAt).toLocaleString('zh-CN')
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      if (row.status === 'completed' && row.result?.projectId) {
        return h(NButton, {
          size: 'small',
          type: 'primary',
          onClick: () => router.push(`/project/${row.result.projectId}`)
        }, () => '查看项目')
      }
      if (row.status === 'failed') {
        return h(NButton, {
          size: 'small',
          onClick: () => handleRetry(row)
        }, () => '重试')
      }
      return '-'
    }
  }
]

const fetchTasks = async () => {
  isLoading.value = true
  try {
    const res = await api.get('/import/tasks')
    tasks.value = res.data.tasks || []
    pagination.value.total = res.data.total || 0
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
  } finally {
    isLoading.value = false
  }
}

const handleRetry = (task: ImportTask) => {
  // Could implement retry logic here
  console.log('Retry task:', task.id)
}

const startPolling = () => {
  pollTimer = setInterval(() => {
    // 只轮询处理中的任务
    const hasProcessing = tasks.value.some(t => t.status === 'pending' || t.status === 'processing')
    if (hasProcessing) {
      fetchTasks()
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
  fetchTasks()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="tasks-page">
    <header class="tasks-header">
      <div>
        <h1>导入任务</h1>
        <p class="tasks-subtitle">查看剧本导入进度和历史</p>
      </div>
      <NSpace>
        <NButton @click="router.push('/projects')">
          返回项目
        </NButton>
      </NSpace>
    </header>

    <NCard class="tasks-card">
      <template #header-extra>
        <NSpace align="center" :size="16">
          <NTag v-if="tasks.some(t => t.status === 'processing')" type="info" size="small">
            🔄 实时更新中
          </NTag>
          <NTag v-else type="default" size="small">
            已同步
          </NTag>
        </NSpace>
      </template>

      <NEmpty v-if="!tasks.length && !isLoading" description="暂无导入任务">
        <template #extra>
          <NButton type="primary" @click="router.push('/projects')">
            去导入剧本
          </NButton>
        </template>
      </NEmpty>

      <NDataTable
        v-else
        :columns="columns"
        :data="tasks"
        :loading="isLoading"
        :bordered="false"
        :row-key="(row: ImportTask) => row.id"
      />
    </NCard>
  </div>
</template>

<style scoped>
.tasks-page {
  min-height: 100vh;
  padding: var(--spacing-lg);
  background: var(--color-bg-base);
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
}

.tasks-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.tasks-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.tasks-card {
  background: var(--color-bg-white);
}
</style>
