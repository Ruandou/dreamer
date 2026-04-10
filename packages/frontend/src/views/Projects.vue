<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NButton, NSpace, NGrid, NGi, NEmpty, NModal, NForm, NFormItem,
  NInput, NInputNumber, NTag, NDropdown, NSelect, NUpload, NUploadDragger,
  useMessage, useDialog, NAlert, NText
} from 'naive-ui'
import type { MenuOption, UploadFileInfo } from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { api } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const projectStore = useProjectStore()

const showCreateModal = ref(false)
const showImportModal = ref(false)
const newProject = ref({ name: '', description: '' })
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')

// Import state
const importContent = ref('')
const importType = ref<'markdown' | 'json'>('markdown')
const isImporting = ref(false)

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

const handleImport = () => {
  showImportModal.value = true
  importContent.value = ''
}

const handleFileChange = (options: { file: UploadFileInfo }) => {
  const file = options.file
  if (!file.file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    importContent.value = e.target?.result as string
    // Auto-detect type
    if (file.name.endsWith('.json')) {
      importType.value = 'json'
    } else {
      importType.value = 'markdown'
    }
  }
  reader.readAsText(file.file)
}

const handleImportProject = async () => {
  if (!importContent.value.trim()) {
    message.warning('请输入或上传剧本内容')
    return
  }

  isImporting.value = true
  try {
    const res = await api.post('/import/project', {
      content: importContent.value,
      type: importType.value
    })

    message.success('导入任务已创建，正在后台处理...')

    // 跳转到任务页面或等待完成
    // 这里简化处理，直接跳转到项目列表刷新
    showImportModal.value = false
    await projectStore.fetchProjects()

    // 提示用户查看新导入的项目
    if (projectStore.projects.length > 0) {
      message.info('请在项目列表中查看导入的项目')
    }
  } catch (error: any) {
    message.error(error.response?.data?.error || '导入失败')
  } finally {
    isImporting.value = false
  }
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
          <NButtonGroup>
            <NButton @click="router.push('/jobs')">
              📋 任务
            </NButton>
            <NButton @click="router.push('/stats')">
              📊 统计
            </NButton>
          </NButtonGroup>
          <NButton @click="handleImport" secondary>
            导入剧本
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
          <NButton type="primary" @click="handleCreate">
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

    <!-- Import Modal -->
    <NModal
      v-model:show="showImportModal"
      preset="card"
      title="导入剧本"
      style="width: 700px"
      :bordered="false"
    >
      <div class="import-modal">
        <NAlert type="info" class="import-alert">
          支持 Markdown 和 JSON 格式的剧本文件。上传后将自动解析并创建项目。
        </NAlert>

        <NUpload
          class="import-upload"
          :multiple="false"
          accept=".md,.markdown,.json"
          :show-file-list="false"
          @change="handleFileChange"
        >
          <NUploadDragger>
            <div class="upload-content">
              <span class="upload-icon">📄</span>
              <NText>点击或拖拽文件到此处上传</NText>
              <NText type="secondary" style="font-size: 12px">
                支持 .md, .markdown, .json 格式
              </NText>
            </div>
          </NUploadDragger>
        </NUpload>

        <NForm :model="{ importContent, importType }" label-placement="top" class="import-form">
          <NFormItem label="剧本内容" path="importContent">
            <NInput
              v-model:value="importContent"
              type="textarea"
              placeholder="或者直接粘贴剧本内容..."
              :rows="6"
            />
          </NFormItem>
          <NFormItem label="格式" path="importType">
            <NSelect
              v-model:value="importType"
              :options="[
                { label: 'Markdown', value: 'markdown' },
                { label: 'JSON', value: 'json' }
              ]"
              style="width: 200px"
            />
          </NFormItem>
        </NForm>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showImportModal = false">取消</NButton>
          <NButton
            type="primary"
            @click="handleImportProject"
            :disabled="!importContent.trim()"
            :loading="isImporting"
          >
            一键导入
          </NButton>
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

/* Import Modal Styles */
.import-modal {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.import-alert {
  margin-bottom: var(--spacing-sm);
}

.import-upload {
  margin-bottom: var(--spacing-md);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-lg);
}

.upload-icon {
  font-size: 32px;
  margin-bottom: var(--spacing-xs);
}

.import-form {
  margin-top: var(--spacing-md);
}
</style>
