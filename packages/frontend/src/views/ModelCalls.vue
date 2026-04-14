<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NInput,
  NDataTable,
  NTag,
  NModal,
  NSpin,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { getModelApiCalls, type ModelApiCallRow } from '@/api'

const router = useRouter()
const message = useMessage()

const loading = ref(false)
const items = ref<ModelApiCallRow[]>([])

const filterOp = ref('')
const filterProjectId = ref('')
const filterModel = ref('')

const promptVisible = ref(false)
const promptTitle = ref('')
const promptBody = ref('')

async function load() {
  loading.value = true
  try {
    const r = await getModelApiCalls({
      limit: 100,
      offset: 0,
      op: filterOp.value.trim() || undefined,
      projectId: filterProjectId.value.trim() || undefined,
      model: filterModel.value.trim() || undefined
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
      return h(NTag, { type: ok ? 'success' : 'error', size: 'small' }, { default: () => row.status })
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
  <div class="model-calls-page">
    <header class="model-calls-header">
      <h1 class="model-calls-title">模型调用日志</h1>
      <p class="model-calls-desc">
        与终端 <code>[model-api]</code> 同源落库，可筛操作 <code>op</code>（如
        <code>script_visual_enrichment</code>）、项目 ID、模型名。点击「提示词」查看完整内容（视觉补全含
        <code>【system】</code> 与 <code>【user】</code>；新产生的记录才含完整 system）。
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
          <NButton type="primary" :loading="loading" @click="load">查询</NButton>
          <NButton @click="
            filterOp = '';
            filterProjectId = '';
            filterModel = '';
            load()
          ">
            清空条件
          </NButton>
          <NButton @click="router.push('/projects')">返回项目</NButton>
        </NSpace>
      </NSpace>
    </NCard>

    <NSpin :show="loading">
      <NCard class="model-calls-table">
        <NDataTable
          :columns="columns"
          :data="items"
          :bordered="false"
          :scroll-x="1100"
          :row-key="(row: ModelApiCallRow) => row.id"
          size="small"
        />
        <p v-if="!loading && items.length === 0" class="model-calls-empty">暂无记录</p>
      </NCard>
    </NSpin>

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
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px 48px;
}
.model-calls-header {
  margin-bottom: 20px;
}
.model-calls-title {
  margin: 0 0 8px;
  font-size: 1.35rem;
  font-weight: 600;
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
  background: rgba(128, 128, 128, 0.12);
}
.model-calls-filters {
  margin-bottom: 16px;
}
.model-calls-table {
  margin-top: 0;
}
.model-calls-empty {
  margin: 16px 0 0;
  text-align: center;
  color: var(--n-text-color-3);
  font-size: 14px;
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
