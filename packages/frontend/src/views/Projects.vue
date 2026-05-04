<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NSpace, NDropdown, NIcon, useMessage, useDialog } from 'naive-ui'
import { EllipsisVerticalOutline } from '@vicons/ionicons5'
import { useProjectStore } from '@/stores/project'
import type { Project } from '@dreamer/shared/types'
import { normalizeProjectName } from '@dreamer/shared'
import { importProject, getImportTaskStatus } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import SearchFilterBar from '@/components/SearchFilterBar.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { useKeyboardShortcuts, commonShortcuts } from '@/composables/useKeyboardShortcuts'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const projectStore = useProjectStore()

const searchQuery = ref('')
const quickIdea = ref('')
const isCreating = ref(false)
const isImporting = ref(false)
const importTaskId = ref<string | null>(null)
const importTaskStatus = ref<'pending' | 'processing' | 'completed' | 'failed'>('pending')
const importedProjectId = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
const fileInputRef = ref<HTMLInputElement | null>(null)

// Async state management for loading and error handling
const {
  loading,
  error,
  hasError,
  execute: fetchProjects
} = useAsyncState(() => projectStore.fetchProjects(), {
  onError: (err) => {
    message.error(`加载项目失败: ${err.message}`)
  }
})

// Keyboard shortcuts
useKeyboardShortcuts([
  {
    ...commonShortcuts.newProject,
    handler: () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder="请输入剧本想法..."]'
      )
      input?.focus()
    }
  },
  {
    ...commonShortcuts.search,
    handler: () => {
      const input = document.querySelector<HTMLInputElement>('input[placeholder="搜索项目..."]')
      input?.focus()
    }
  }
])

onMounted(() => {
  void fetchProjects()
})

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) {
    return projectStore.projects
  }
  const query = searchQuery.value.toLowerCase()
  return projectStore.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
  )
})

const handleFileInputClick = () => {
  fileInputRef.value?.click()
}

const handleFileInputChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    quickIdea.value = ev.target?.result as string
    message.success('剧本已导入')
  }
  reader.readAsText(file)
}

const handleDrop = (e: DragEvent) => {
  const files = e.dataTransfer?.files
  if (!files?.length) return

  const file = files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    quickIdea.value = ev.target?.result as string
    message.success('剧本已导入')
  }
  reader.readAsText(file)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(taskId: string) {
  importTaskId.value = taskId
  importTaskStatus.value = 'pending'
  pollTimer = setInterval(async () => {
    try {
      const task = await getImportTaskStatus(taskId)
      importTaskStatus.value = task.status

      if (task.status === 'completed') {
        stopPolling()
        isImporting.value = false
        const projectId = task.projectId || task.result?.projectId || null
        importedProjectId.value = projectId
        message.success('剧本导入成功')
        if (projectId) {
          router.push(`/project/${projectId}`)
        }
      } else if (task.status === 'failed') {
        stopPolling()
        isImporting.value = false
        message.error(task.errorMsg || '导入失败')
      }
    } catch (error: any) {
      stopPolling()
      isImporting.value = false
      message.error(error?.response?.data?.message || '查询任务状态失败')
    }
  }, 2000)
}

function isLikelyScriptContent(text: string): boolean {
  const t = text.trim()
  if (t.length > 500) return true
  const scriptPatterns = [
    /^#+\s*第[一二三四五六七八九十\d]+[集章]/m,
    /^#+\s*.*[场景場景]/m,
    /\n\s*角色[:：]/m,
    /\n\s*人物[:：]/m,
    /^\s*\w+[:：]\s*["""']/m,
    /^\s*(INT|EXT|内景|外景)[\.\s]/m
  ]
  return scriptPatterns.some((p) => p.test(t))
}

const handleQuickCreate = async () => {
  if (!quickIdea.value.trim()) {
    message.warning('请输入剧本想法')
    return
  }

  const idea = quickIdea.value.trim()

  if (isLikelyScriptContent(idea)) {
    isImporting.value = true
    try {
      const result = await importProject(idea, 'markdown')
      startPolling(result.taskId)
    } catch (e: any) {
      isImporting.value = false
      message.error(e.message || '导入失败')
    }
    return
  }

  isCreating.value = true
  try {
    const name = normalizeProjectName(idea)
    const project = await projectStore.createProject({
      name,
      description: idea
    })
    router.push(`/project/${project.id}`)
  } catch (e: any) {
    message.error(e.message || '创建项目失败')
  } finally {
    isCreating.value = false
  }
}

/**
 * 已解析（库里有角色）→ 项目详情；
 * 解析进行中尚无角色 → 进项目详情并带 parseJobId；
 * 否则 → 生成大纲页。
 * 先拉 GET /projects/:id，避免列表里 characters 滞后（解析刚完成仍显示 0）。
 */
const handleProjectClick = async (project: Project) => {
  // Always navigate to project detail; let the detail page handle empty states
  router.push(`/project/${project.id}`)
}

const handleDelete = (id: string) => {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这个项目吗？此操作不可撤销。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await projectStore.deleteProject(id)
      message.success('项目已删除')
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

const projectEmojis = [
  '🎬',
  '🎭',
  '🎪',
  '🎨',
  '🎸',
  '🎮',
  '📚',
  '🚀',
  '🌟',
  '🎩',
  '🎺',
  '🎻',
  '🎯',
  '🎲',
  '🎳'
]

const projectGradients = [
  'linear-gradient(135deg, #f4726a 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
  'linear-gradient(135deg, #34d399 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #fb923c 0%, #f4726a 100%)',
  'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #f472b6 0%, #fb923c 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #34d399 100%)',
  'linear-gradient(135deg, #fbbf24 0%, #f4726a 100%)'
]

function getProjectEmoji(projectId: string): string {
  let hash = 0
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash + projectId.charCodeAt(i)) | 0
  }
  return projectEmojis[Math.abs(hash) % projectEmojis.length]
}

function getProjectCoverStyle(_projectId: string, index: number): string {
  const gradient = projectGradients[index % projectGradients.length]
  return `background: ${gradient};`
}

const dropdownOptions = [{ label: '删除', key: 'delete' }]

const handleDropdownSelect = (key: string, projectId: string) => {
  if (key === 'delete') {
    handleDelete(projectId)
  }
}
</script>

<template>
  <div class="projects-page page-shell">
    <!-- Header -->
    <header class="projects-header">
      <div class="projects-header__info">
        <h1 class="projects-header__title">我的项目</h1>
        <p class="projects-header__count" v-if="projectStore.projects.length && !loading">
          共 {{ projectStore.projects.length }} 个项目
        </p>
      </div>
      <div class="projects-header__actions">
        <SearchFilterBar
          v-model="searchQuery"
          placeholder="搜索项目... (⌘K)"
          search-width="200px"
        />
      </div>
    </header>

    <!-- Error Boundary -->
    <ErrorBoundary
      :has-error="hasError"
      :error="error || undefined"
      title="加载项目失败"
      @retry="fetchProjects"
    />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="projects-loading">
      <SkeletonLoader :rows="3" variant="grid" :show-header="false" />
    </div>

    <!-- Quick Create -->
    <div
      v-else
      class="quick-create"
      @drop.prevent="handleDrop"
      @dragover.prevent
      @dragenter.prevent
    >
      <div class="quick-create__input-wrap">
        <textarea
          v-model="quickIdea"
          class="quick-create__textarea"
          placeholder="输入想法，快速创建短剧... 或 拖拽剧本文件到此处 (⌘N)"
          rows="3"
          @keydown.ctrl.enter="handleQuickCreate"
        />
      </div>
      <div v-if="isImporting" class="quick-create__importing">
        <StatusBadge :status="importTaskStatus" />
        <span class="quick-create__importing-text">
          <span v-if="importTaskStatus === 'pending'">等待处理</span>
          <span v-else-if="importTaskStatus === 'processing'">AI 正在解析剧本...</span>
          <span v-else-if="importTaskStatus === 'completed'">导入完成</span>
          <span v-else-if="importTaskStatus === 'failed'">导入失败</span>
        </span>
      </div>
      <div class="quick-create__actions">
        <NSpace justify="center">
          <NButton secondary @click="handleFileInputClick" :disabled="isImporting"
            >导入剧本</NButton
          >
          <NButton
            type="primary"
            @click="handleQuickCreate"
            :disabled="!quickIdea.trim() || isImporting"
            :loading="isCreating || isImporting"
          >
            生成大纲 →
          </NButton>
        </NSpace>
      </div>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept=".md,.txt,.json"
      style="display: none"
      @change="handleFileInputChange"
    />

    <!-- Content -->
    <div class="projects-content">
      <!-- Empty State -->
      <EmptyState
        v-if="!projectStore.projects.length && !loading"
        title="暂无项目"
        description="在上方快速创建区输入想法、导入剧本或拖入文件，生成大纲后即可开始创作"
        :icon-size="48"
        :show-background="true"
        variant="large"
      >
        <template #action>
          <NButton type="primary" @click="router.push('/import')"> 导入剧本 </NButton>
        </template>
      </EmptyState>

      <!-- Search Empty -->
      <EmptyState
        v-else-if="!filteredProjects.length"
        title="未找到项目"
        :description="`未找到包含「${searchQuery}」的项目`"
        :icon-size="48"
        :show-background="true"
      >
        <template #action>
          <NButton @click="searchQuery = ''">清除搜索</NButton>
        </template>
      </EmptyState>

      <!-- Grid View -->
      <template v-else>
        <div class="projects-grid">
          <div
            v-for="(project, index) in filteredProjects"
            :key="project.id"
            class="project-card"
            @click="handleProjectClick(project)"
          >
            <div class="project-card__cover" :style="getProjectCoverStyle(project.id, index)">
              <div class="project-card__cover-overlay" />
              <span class="project-card__emoji">{{ getProjectEmoji(project.id) }}</span>
              <StatusBadge status="draft" class="project-card__status" />
            </div>

            <div class="project-card__body">
              <h3 class="project-card__title">{{ project.name }}</h3>
              <p class="project-card__desc">
                {{ project.description || '暂无描述' }}
              </p>
            </div>

            <div class="project-card__footer">
              <span class="project-card__date">{{ formatDate(project.createdAt) }}</span>
              <NDropdown
                :options="dropdownOptions"
                @select="(key) => handleDropdownSelect(key, project.id)"
                trigger="click"
                @click.stop
              >
                <NButton text size="small" @click.stop>
                  <template #icon>
                    <NIcon :component="EllipsisVerticalOutline" :size="16" />
                  </template>
                </NButton>
              </NDropdown>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.projects-header__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.projects-header__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.projects-content {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  min-height: 400px;
}

.projects-loading {
  margin-top: var(--spacing-lg);
}

.quick-create {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: 28px var(--spacing-lg);
  background: linear-gradient(135deg, var(--color-bg-white) 0%, var(--color-bg-cream) 100%);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--color-border);
  transition: all 0.3s ease;
}

.quick-create:hover {
  border-color: var(--color-primary-hover);
  background: linear-gradient(135deg, var(--color-bg-white) 0%, #fff1f2 100%);
}

.quick-create__icon {
  font-size: 32px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.quick-create__input-wrap {
  width: 100%;
  max-width: 640px;
}

.quick-create__textarea {
  width: 100%;
  padding: 14px 18px;
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  background: var(--color-bg-white);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  resize: vertical;
  outline: none;
  transition: all 0.25s ease;
  font-family: inherit;
}

.quick-create__textarea::placeholder {
  color: var(--color-text-tertiary);
}

.quick-create__textarea:hover {
  border-color: var(--color-primary-hover);
}

.quick-create__textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(244, 114, 106, 0.15);
}

.quick-create__actions {
  display: flex;
  justify-content: center;
}

.quick-create__importing {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.project-card {
  cursor: pointer;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInUp 0.45s ease-out both;
}

.project-card:nth-child(1) {
  animation-delay: 0ms;
}
.project-card:nth-child(2) {
  animation-delay: 60ms;
}
.project-card:nth-child(3) {
  animation-delay: 120ms;
}
.project-card:nth-child(4) {
  animation-delay: 180ms;
}
.project-card:nth-child(5) {
  animation-delay: 240ms;
}
.project-card:nth-child(6) {
  animation-delay: 300ms;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.project-card:hover {
  transform: translateY(-5px) scale(1.01);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-border);
}

.project-card__cover {
  position: relative;
  height: 140px;
  border-radius: var(--radius-md);
  margin: 12px 12px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.project-card__cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.08) 100%);
  pointer-events: none;
}

.project-card__emoji {
  font-size: 44px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
  z-index: 1;
  transition: transform 0.3s ease;
}

.project-card:hover .project-card__emoji {
  transform: scale(1.15) rotate(-5deg);
}

.project-card__status {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.project-card__body {
  padding: 0 16px;
}

.project-card__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 38px;
  margin: 0;
}

.project-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--color-border-light);
}

.project-card__date {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-medium);
}
</style>
