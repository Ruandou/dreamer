<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NButton,
  NDataTable,
  NTag,
  NModal,
  NPagination,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { getModelApiCalls, type ModelApiCallRow } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const route = useRoute()
const message = useMessage()
const projectId = route.params.id as string

const loading = ref(false)
const items = ref<ModelApiCallRow[]>([])
const page = ref(1)
const pageSize = ref(10)
const totalItems = ref(0)

const promptVisible = ref(false)
const promptTitle = ref('')
const promptBody = ref('')

async function load() {
  loading.value = true
  try {
    const offset = (page.value - 1) * pageSize.value
    const r = await getModelApiCalls({
      limit: pageSize.value,
      offset,
      projectId
    })
    items.value = r.items
    totalItems.value = r.total
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    message.error(err?.response?.data?.error || err?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handlePageSizeChange() {
  page.value = 1
  load()
}

function openPrompt(row: ModelApiCallRow) {
  promptTitle.value = `${row.provider} ${row.model} · ${row.meta?.op || row.status}`
  promptBody.value = row.prompt || ''
  promptVisible.value = true
}

const columns: DataTableColumns<ModelApiCallRow> = [
  {
    title: '时间',
    key: 'createdAt',
    width: 172,
    render(row) {
      return new Date(row.createdAt).toLocaleString('zh-CN')
    }
  },
  { title: '提供商', key: 'provider', width: 96 },
  { title: '模型', key: 'model', width: 132, ellipsis: { tooltip: true } },
  {
    title: '操作 op',
    key: 'op',
    width: 200,
    ellipsis: { tooltip: true },
    render(row) {
      return row.meta?.op || '—'
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      const ok = row.status === 'completed'
      return h(
        NTag,
        { type: ok ? 'success' : 'error', size: 'small' },
        { default: () => row.status }
      )
    }
  },
  {
    title: '成本(¥)',
    key: 'cost',
    width: 100,
    render(row) {
      return row.cost != null ? Number(row.cost).toFixed(4) : '—'
    }
  },
  {
    title: '错误',
    key: 'errorMsg',
    ellipsis: { tooltip: true },
    render(row) {
      return row.errorMsg || '—'
    }
  },
  {
    title: '',
    key: 'actions',
    width: 88,
    fixed: 'right',
    render(row) {
      return h(
        NButton,
        { size: 'small', quaternary: true, onClick: () => openPrompt(row) },
        { default: () => '提示词' }
      )
    }
  }
]

onMounted(load)
</script>

<template>
  <div class="project-model-calls page-shell">
    <h2 class="page-title">模型日志</h2>
    <p class="page-subtitle">当前项目的模型调用记录</p>
    <NCard class="model-calls-table" :bordered="false">
      <div v-if="loading && items.length === 0" class="model-calls-loading">
        <SkeletonLoader variant="table" :rows="5" />
      </div>
      <div v-else>
        <NDataTable
          :columns="columns"
          :data="items"
          :bordered="false"
          :scroll-x="1100"
          :row-key="(row: ModelApiCallRow) => row.id"
          size="small"
        />
        <EmptyState
          v-if="items.length === 0"
          title="暂无模型调用记录"
          description="执行模型调用后，日志会显示在这里"
          icon="🔍"
          :icon-size="48"
          variant="compact"
        />
        <div v-if="totalItems > pageSize || pageSize !== 10" class="model-calls-pagination">
          <NPagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :item-count="totalItems"
            :page-sizes="[10, 20, 50]"
            show-size-picker
            @update:page="load()"
            @update:page-size="handlePageSizeChange"
          />
        </div>
      </div>
    </NCard>

    <NModal
      v-model:show="promptVisible"
      preset="card"
      :title="promptTitle"
      style="width: min(920px, 96vw)"
      :segmented="{ content: true }"
    >
      <pre class="model-calls-prompt">{{ promptBody || '（空）' }}</pre>
    </NModal>
  </div>
</template>

<style scoped>
.project-model-calls {
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

.model-calls-table {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
}

.model-calls-loading {
  padding: var(--spacing-xl) 0;
}

.model-calls-pagination {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: center;
}

.model-calls-prompt {
  margin: 0;
  max-height: 70vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 768px) {
  .project-model-calls :deep(.n-data-table) {
    font-size: 12px;
  }
}
</style>
