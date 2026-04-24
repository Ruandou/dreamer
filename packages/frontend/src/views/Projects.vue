<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NSpace, NDropdown, NIcon, useMessage, useDialog } from 'naive-ui'
import { FilmOutline, EllipsisVerticalOutline } from '@vicons/ionicons5'
import { useProjectStore } from '@/stores/project'
import type { Project } from '@dreamer/shared/types'
import { normalizeProjectName } from '@dreamer/shared'
import { api } from '@/api'
import type { PipelineJob } from '@/api'
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

const handleQuickCreate = async () => {
  if (!quickIdea.value.trim()) {
    message.warning('请输入剧本想法')
    return
  }
  isCreating.value = true
  try {
    const idea = quickIdea.value.trim()
    const name = normalizeProjectName(idea)
    const project = await projectStore.createProject({
      name,
      description: idea
    })
    router.push(`/generate?projectId=${project.id}&autogen=1`)
  } catch (e: any) {
    message.error(e.message || '创建项目失败')
  } finally {
    isCreating.value = false
  }
}

function isParseScriptOutlineJob(job: PipelineJob | null | undefined): boolean {
  if (!job) return false
  const jt = (job.jobType ?? '').toString().trim().toLowerCase()
  const step = (job.currentStep ?? '').toString().trim().toLowerCase()
  return jt === 'parse-script' || step === 'parse-script'
}

function hasAnyCharacter(project: Project | null | undefined): boolean {
  return (project?.characters?.length ?? 0) > 0
}

/**
 * 已解析（库里有角色）→ 项目详情；
 * 解析进行中尚无角色 → 进项目详情并带 parseJobId；
 * 否则 → 生成大纲页。
 * 先拉 GET /projects/:id，避免列表里 characters 滞后（解析刚完成仍显示 0）。
 */
const handleProjectClick = async (project: Project) => {
  let fresh: Project | null = null
  try {
    const res = await api.get<Project>(`/projects/${project.id}`)
    fresh = res.data
  } catch {
    fresh = null
  }

  if (hasAnyCharacter(fresh) || hasAnyCharacter(project)) {
    router.push(`/project/${project.id}`)
    return
  }

  try {
    const res = await api.get<{ job: PipelineJob | null }>(
      `/projects/${project.id}/outline-active-job`
    )
    const job = res.data?.job
    if (
      job &&
      (job.status === 'pending' || job.status === 'running') &&
      isParseScriptOutlineJob(job)
    ) {
      router.push(`/project/${project.id}?parseJobId=${job.id}`)
      return
    }
  } catch {
    /* ignore */
  }
  router.push(`/generate?projectId=${project.id}`)
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
        <NInput
          v-model:value="quickIdea"
          type="textarea"
          placeholder="输入想法，快速创建短剧... 或 拖拽剧本文件到此处 (⌘N)"
          :rows="3"
          @keydown.enter.ctrl="handleQuickCreate"
        />
      </div>
      <div class="quick-create__actions">
        <NSpace justify="center">
          <NButton secondary @click="handleFileInputClick">导入剧本</NButton>
          <NButton
            type="primary"
            @click="handleQuickCreate"
            :disabled="!quickIdea.trim()"
            :loading="isCreating"
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
          <NButton type="primary" @click="router.push('/generate')"> 创建第一个项目 </NButton>
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
          <NCard
            v-for="project in filteredProjects"
            :key="project.id"
            class="project-card"
            hoverable
            @click="handleProjectClick(project)"
          >
            <div class="project-card__cover">
              <div class="project-card__cover-placeholder">
                <NIcon :component="FilmOutline" :size="48" />
              </div>
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
          </NCard>
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
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
}

.quick-create__input-wrap {
  width: 100%;
}

.quick-create__actions {
  display: flex;
  justify-content: center;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.project-card {
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

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.project-card__cover {
  position: relative;
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-card__cover-placeholder {
  font-size: 48px;
  opacity: 0.8;
}

.project-card__status {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
}

.project-card__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
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
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.project-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.project-card__date {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
</style>
