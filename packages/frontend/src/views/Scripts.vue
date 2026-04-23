<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NInput,
  NTag,
  NTabs,
  NTabPane,
  NIcon,
  useMessage,
  useDialog
} from 'naive-ui'
import { SearchOutline, AddOutline } from '@vicons/ionicons5'
import { api } from '@/api'
import type { Script } from '@dreamer/shared/types'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import { useAsyncState } from '@/composables/useAsyncState'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const scripts = ref<Script[]>([])
const searchQuery = ref('')
const activeTag = ref<string | null>(null)
const activeStatus = ref<string>('all')
const isCreating = ref(false)

const PREDEFINED_TAGS = [
  // 受众
  '男频',
  '女频',
  // 时代背景
  '古代',
  '现代',
  '民国',
  '未来',
  // 题材
  '历史',
  '穿越',
  '重生',
  '都市',
  '玄幻',
  '仙侠',
  '武侠',
  '科幻',
  '悬疑',
  '惊悚',
  '恐怖',
  // 情感
  '甜宠',
  '虐恋',
  '复仇',
  '逆袭',
  '先婚后爱',
  '霸道总裁',
  '宫斗',
  '宅斗',
  // 风格
  '轻松',
  '热血',
  '暗黑',
  '治愈',
  '搞笑',
  '正能量'
]

const {
  loading,
  error,
  hasError,
  execute: fetchScripts
} = useAsyncState(
  async () => {
    const params = new URLSearchParams()
    if (activeTag.value) params.set('tag', activeTag.value)
    if (activeStatus.value !== 'all') params.set('status', activeStatus.value)
    const res = await api.get<Script[]>(`/scripts?${params.toString()}`)
    scripts.value = res.data
  },
  {
    onError: (err) => {
      message.error(`加载剧本失败: ${err.message}`)
    }
  }
)

onMounted(() => {
  void fetchScripts()
})

const filteredScripts = computed(() => {
  if (!searchQuery.value.trim()) return scripts.value
  const query = searchQuery.value.toLowerCase()
  return scripts.value.filter(
    (s) =>
      s.title.toLowerCase().includes(query) ||
      s.content.toLowerCase().includes(query) ||
      s.tags.some((t) => t.toLowerCase().includes(query))
  )
})

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: '草稿',
    READY: '定稿',
    ARCHIVED: '已归档'
  }
  return map[status] || status
}

const statusType = (status: string) => {
  const map: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    DRAFT: 'warning',
    READY: 'success',
    ARCHIVED: 'default'
  }
  return map[status] || 'default'
}

const handleTagClick = (tag: string) => {
  if (activeTag.value === tag) {
    activeTag.value = null
  } else {
    activeTag.value = tag
  }
  void fetchScripts()
}

const clearTagFilter = () => {
  activeTag.value = null
  void fetchScripts()
}

const handleStatusChange = (tab: string) => {
  activeStatus.value = tab
  void fetchScripts()
}

const handleCreate = async () => {
  isCreating.value = true
  try {
    const res = await api.post<Script>('/scripts', {
      title: '未命名剧本',
      content: ''
    })
    message.success('剧本已创建')
    router.push(`/studio/${res.data.id}`)
  } catch (e: any) {
    message.error(e.message || '创建剧本失败')
  } finally {
    isCreating.value = false
  }
}

const handleDelete = (id: string) => {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这个剧本吗？此操作不可撤销。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.delete(`/scripts/${id}`)
        message.success('剧本已删除')
        void fetchScripts()
      } catch {
        message.error('删除失败')
      }
    }
  })
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const contentPreview = (content: string) => {
  if (!content) return '暂无内容'
  return content.replace(/\n/g, ' ').slice(0, 80) + (content.length > 80 ? '...' : '')
}
</script>

<template>
  <div class="scripts-page page-shell">
    <!-- Header -->
    <header class="scripts-header">
      <div class="scripts-header__info">
        <h1 class="scripts-header__title">我的剧本</h1>
        <p class="scripts-header__count" v-if="scripts.length && !loading">
          共 {{ scripts.length }} 个剧本
        </p>
      </div>
      <div class="scripts-header__actions">
        <NSpace>
          <NInput
            v-model:value="searchQuery"
            placeholder="搜索剧本..."
            clearable
            style="width: 200px"
          >
            <template #prefix>
              <NIcon :component="SearchOutline" :size="16" />
            </template>
          </NInput>
          <NButton type="primary" @click="handleCreate" :loading="isCreating">
            <template #icon>
              <NIcon :component="AddOutline" :size="16" />
            </template>
            新建剧本
          </NButton>
        </NSpace>
      </div>
    </header>

    <!-- Tag Filter -->
    <div class="scripts-tag-filter">
      <NSpace size="small">
        <span class="tag-filter-label">标签筛选：</span>
        <NTag
          v-for="tag in PREDEFINED_TAGS"
          :key="tag"
          size="small"
          :type="activeTag === tag ? 'primary' : 'default'"
          style="cursor: pointer"
          @click="handleTagClick(tag)"
        >
          {{ tag }}
        </NTag>
        <NButton v-if="activeTag" text size="small" @click="clearTagFilter"> 清除筛选 </NButton>
      </NSpace>
    </div>

    <!-- Status Tabs -->
    <NTabs
      type="line"
      :value="activeStatus"
      @update:value="handleStatusChange"
      class="scripts-tabs"
    >
      <NTabPane name="all" tab="全部" />
      <NTabPane name="DRAFT" tab="草稿" />
      <NTabPane name="READY" tab="定稿" />
      <NTabPane name="ARCHIVED" tab="已归档" />
    </NTabs>

    <!-- Error Boundary -->
    <ErrorBoundary
      :has-error="hasError"
      :error="error || undefined"
      title="加载剧本失败"
      @retry="fetchScripts"
    />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="scripts-loading">
      <SkeletonLoader :rows="3" variant="grid" :show-header="false" />
    </div>

    <!-- Content -->
    <div class="scripts-content">
      <!-- Empty State -->
      <EmptyState
        v-if="!scripts.length && !loading"
        title="暂无剧本"
        description="点击右上角「新建剧本」开始创作"
        :icon-size="48"
        :show-background="true"
        variant="large"
      >
        <template #action>
          <NButton type="primary" @click="handleCreate" :loading="isCreating">
            创建第一个剧本
          </NButton>
        </template>
      </EmptyState>

      <!-- Search Empty -->
      <EmptyState
        v-else-if="!filteredScripts.length"
        title="未找到剧本"
        :description="`未找到包含「${searchQuery}」的剧本`"
        :icon-size="48"
        :show-background="true"
      >
        <template #action>
          <NButton @click="searchQuery = ''">清除搜索</NButton>
        </template>
      </EmptyState>

      <!-- Grid View -->
      <template v-else>
        <div class="scripts-grid">
          <NCard
            v-for="script in filteredScripts"
            :key="script.id"
            class="script-card"
            hoverable
            @click="router.push(`/studio/${script.id}`)"
          >
            <div class="script-card__header">
              <h3 class="script-card__title">{{ script.title }}</h3>
              <NTag :type="statusType(script.status)" size="small">
                {{ statusLabel(script.status) }}
              </NTag>
            </div>

            <p class="script-card__preview">
              {{ contentPreview(script.content) }}
            </p>

            <div class="script-card__tags">
              <NTag v-for="tag in script.tags" :key="tag" size="small" type="info">
                {{ tag }}
              </NTag>
              <span v-if="!script.tags.length" class="no-tags">无标签</span>
            </div>

            <div class="script-card__footer">
              <span class="script-card__date">{{ formatDate(script.updatedAt) }}</span>
              <NSpace>
                <NButton text size="small" @click.stop="router.push(`/studio/${script.id}`)">
                  编辑
                </NButton>
                <NButton text size="small" type="error" @click.stop="handleDelete(script.id)">
                  删除
                </NButton>
              </NSpace>
            </div>
          </NCard>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.scripts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.scripts-header__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.scripts-header__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.scripts-tag-filter {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.tag-filter-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 24px;
}

.scripts-tabs {
  margin-bottom: var(--spacing-md);
}

.scripts-content {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  min-height: 400px;
}

.scripts-loading {
  margin-top: var(--spacing-lg);
}

.scripts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.script-card {
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
  animation: fadeInUp 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.script-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.script-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.script-card__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: var(--spacing-sm);
}

.script-card__preview {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 60px;
  margin-bottom: var(--spacing-md);
}

.script-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
  min-height: 24px;
}

.no-tags {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.script-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.script-card__date {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
</style>
