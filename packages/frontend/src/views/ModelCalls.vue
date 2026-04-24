<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NInput,
  NSelect,
  NDataTable,
  NTag,
  NModal,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { getModelApiCalls, type ModelApiCallRow } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const router = useRouter()
const message = useMessage()

const loading = ref(false)
const items = ref<ModelApiCallRow[]>([])

const filterOp = ref('')
const filterProjectId = ref('')
const filterModel = ref('')
/** null 表示不筛状态 */
const filterStatus = ref<'completed' | 'failed' | null>(null)

const promptVisible = ref(false)
const promptTitle = ref('')
const promptBody = ref('')

/** 与后端存库的 op 一致（下划线）；把连字符写成横杠时也能筛到 */
function normalizeOpQuery(raw: string): string {
  return raw.trim().replace(/-/g, '_')
}

async function load() {
  loading.value = true
  try {
    const opRaw = filterOp.value.trim()
    const r = await getModelApiCalls({
      limit: 200,
      offset: 0,
      op: opRaw ? normalizeOpQuery(opRaw) : undefined,
      projectId: filterProjectId.value.trim() || undefined,
      model: filterModel.value.trim() || undefined,
      status: filterStatus.value ?? undefined
    })
    items.value = r.items
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    message.error(err?.response?.data?.error || err?.message || '加载失败')
  } finally {
    loading.value = false
  }
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
    title: '项目',
    key: 'project',
    width: 112,
    render(row) {
      const pid = row.meta?.projectId
      if (!pid) return '—'
      return h(
        NButton,
        {
          text: true,
          type: 'primary',
          size: 'small',
          onClick: () => router.push(`/project/${pid}`)
        },
        { default: () => `${pid.slice(0, 10)}…` }
      )
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
  <div class="model-calls-page page-shell">
    <header class="model-calls-header">
      <h1 class="page-title model-calls-title">模型调用日志</h1>
      <p class="model-calls-desc">
        与终端 <code>[model-api]</code> 同源落库；失败记录也会写入（状态为
        <code>failed</code>）。若页面上看不到任何失败，请看后端是否出现
        <code>未写入 ModelApiCall：缺少 ModelCallLogContext</code
        >（表示调用未带审计上下文）。定场/定妆对应 <code>op=script_visual_enrichment</code>。
      </p>
    </header>

    <NCard class="model-calls-filters">
      <NSpace vertical>
        <NSpace wrap>
          <NInput
            v-model:value="filterOp"
            placeholder="op，如 script_visual_enrichment"
            clearable
            style="width: 260px"
            @keyup.enter="load"
          />
          <NInput
            v-model:value="filterProjectId"
            placeholder="projectId（项目 cuid）"
            clearable
            style="width: 280px"
            @keyup.enter="load"
          />
          <NInput
            v-model:value="filterModel"
            placeholder="模型，如 deepseek-chat"
            clearable
            style="width: 200px"
            @keyup.enter="load"
          />
          <NSelect
            v-model:value="filterStatus"
            placeholder="状态"
            clearable
            style="width: 120px"
            :options="[
              { label: '成功', value: 'completed' },
              { label: '失败', value: 'failed' }
            ]"
            @update:value="load"
          />
          <NButton type="primary" :loading="loading" @click="load">查询</NButton>
          <NButton
            secondary
            @click="
              filterOp = 'script_visual_enrichment'
              load()
            "
          >
            定场/定妆
          </NButton>
          <NButton
            secondary
            @click="
              filterOp = 'import_parse_script'
              load()
            "
          >
            导入解析
          </NButton>
          <NButton
            @click="
              filterOp = ''
              filterProjectId = ''
              filterModel = ''
              filterStatus = null
              load()
            "
          >
            清空条件
          </NButton>
          <NButton @click="router.push('/projects')">返回项目</NButton>
        </NSpace>
      </NSpace>
    </NCard>

    <div v-if="loading && items.length === 0" class="model-calls-loading">
      <SkeletonLoader variant="table" :rows="5" />
    </div>
    <div v-else>
      <NCard class="model-calls-table">
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
          title="暂无调用记录"
          description="执行模型调用后，日志会显示在这里"
          icon="🔍"
          :icon-size="48"
          variant="compact"
        />
      </NCard>
    </div>

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
.model-calls-page {
  padding-bottom: var(--spacing-2xl);
}
.model-calls-header {
  margin-bottom: var(--spacing-lg);
}
.model-calls-title {
  margin-bottom: var(--spacing-sm);
}
.model-calls-desc {
  margin: 0;
  color: var(--n-text-color-3);
  font-size: 13px;
  line-height: 1.5;
}
.model-calls-desc code {
  font-size: 12px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--color-bg-gray, rgba(128, 128, 128, 0.12));
}

@media (max-width: 768px) {
  .model-calls-page :deep(.n-data-table) {
    font-size: 12px;
  }
  .model-calls-page :deep(th:nth-child(3)),
  .model-calls-page :deep(td:nth-child(3)),
  .model-calls-page :deep(th:nth-child(7)),
  .model-calls-page :deep(td:nth-child(7)) {
    display: none;
  }
}
.model-calls-filters {
  margin-bottom: 16px;
}
.model-calls-loading {
  padding: var(--spacing-xl) 0;
}
.model-calls-table {
  margin-top: 0;
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
</style>
