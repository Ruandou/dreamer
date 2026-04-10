<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NButton, NSpace, NGrid, NGi, NEmpty, NModal, NForm, NFormItem,
  NInput, NInputNumber, NTag, NDropdown, NSelect, useMessage
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const router = useRouter()
const message = useMessage()
const projectStore = useProjectStore()

const showCreateModal = ref(false)
const newProject = ref({ name: '', description: '' })
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')

onMounted(() => {
  projectStore.fetchProjects()
})

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) {
    return projectStore.projects
  }
  const query = searchQuery.value.toLowerCase()
  return projectStore.projects.filter(
    p => p.name.toLowerCase().includes(query) ||
         (p.description && p.description.toLowerCase().includes(query))
  )
})

const handleCreate = () => {
  showCreateModal.value = true
}

const handleSubmit = async () => {
  if (!newProject.value.name.trim()) {
    message.warning('请输入项目名称')
    return
  }
  const project = await projectStore.createProject(newProject.value)
  showCreateModal.value = false
  newProject.value = { name: '', description: '' }
  router.push(`/project/${project.id}`)
}

const handleProjectClick = (id: string) => {
  router.push(`/project/${id}`)
}

const handleDelete = async (id: string) => {
  await projectStore.deleteProject(id)
  message.success('项目已删除')
}

const getProjectStats = (project: any) => {
  // Placeholder - in real app would compute from episodes, scenes etc
  return {
    episodes: 0,
    progress: 0
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const dropdownOptions = [
  { label: '编辑', key: 'edit' },
  { label: '删除', key: 'delete' }
]

const handleDropdownSelect = (key: string, projectId: string) => {
  if (key === 'delete') {
    handleDelete(projectId)
  }
}
</script>

<template>
  <div class="projects-page">
    <!-- Header -->
    <header class="projects-header">
      <div class="projects-header__info">
        <h1 class="projects-header__title">我的项目</h1>
        <p class="projects-header__count" v-if="projectStore.projects.length">
          共 {{ projectStore.projects.length }} 个项目
        </p>
      </div>
      <div class="projects-header__actions">
        <NSpace>
          <NInput
            v-model:value="searchQuery"
            placeholder="搜索项目..."
            clearable
            style="width: 200px"
          >
            <template #prefix>
              <span class="search-icon">🔍</span>
            </template>
          </NInput>
          <NButton @click="router.push('/stats')">
            成本统计
          </NButton>
          <NButton @click="handleCreate" type="primary">
            <template #icon>
              <span>+</span>
            </template>
            新建项目
          </NButton>
        </NSpace>
      </div>
    </header>

    <!-- Content -->
    <div class="projects-content">
      <!-- Empty State -->
      <EmptyState
        v-if="!projectStore.projects.length"
        title="暂无项目"
        description="创建你的第一个短剧项目，开始 AI 创作之旅"
        icon="🎬"
      >
        <template #action>
          <NButton type="primary" size="large" @click="handleCreate">
            创建第一个项目
          </NButton>
        </template>
      </EmptyState>

      <!-- Search Empty -->
      <EmptyState
        v-else-if="!filteredProjects.length"
        title="未找到项目"
        description="尝试其他搜索词"
        icon="🔍"
      />

      <!-- Grid View -->
      <template v-else>
        <div class="projects-grid">
          <NCard
            v-for="project in filteredProjects"
            :key="project.id"
            class="project-card"
            hoverable
            @click="handleProjectClick(project.id)"
          >
            <div class="project-card__cover">
              <div class="project-card__cover-placeholder">
                🎬
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
                  ⋮
                </NButton>
              </NDropdown>
            </div>
          </NCard>
        </div>
      </template>
    </div>

    <!-- Create Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="新建项目"
      style="width: 480px"
      :bordered="false"
    >
      <NForm :model="newProject" label-placement="top">
        <NFormItem label="项目名称" path="name">
          <NInput
            v:value="newProject.name"
            placeholder="给你的短剧起个名字"
          />
        </NFormItem>
        <NFormItem label="项目描述" path="description">
          <NInput
            v:value="newProject.description"
            type="textarea"
            placeholder="简要描述故事背景或创作方向（可选）"
            :rows="3"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit">创建项目</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.projects-page {
  min-height: 100vh;
  padding: var(--spacing-lg);
  background: var(--color-bg-base);
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
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

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.project-card {
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
}

.project-card:hover {
  transform: translateY(-2px);
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

.search-icon {
  font-size: 14px;
}
</style>
