<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NSpace, NGrid, NGi, NEmpty, NModal, NForm, NFormItem, NInput, NInputNumber } from 'naive-ui'
import { useProjectStore } from '@/stores/project'

const router = useRouter()
const projectStore = useProjectStore()
const showCreateModal = ref(false)
const newProject = ref({ name: '', description: '' })

onMounted(() => {
  projectStore.fetchProjects()
})

const handleCreate = () => {
  showCreateModal.value = true
}

const handleSubmit = async () => {
  const project = await projectStore.createProject(newProject.value)
  showCreateModal.value = false
  router.push(`/project/${project.id}`)
}

const handleProjectClick = (id: string) => {
  router.push(`/project/${id}`)
}
</script>

<template>
  <div class="projects-container">
    <header class="projects-header">
      <h1>我的项目</h1>
      <NButton type="primary" @click="handleCreate">新建项目</NButton>
    </header>

    <div class="projects-content">
      <NGrid v-if="projectStore.projects.length" :cols="3" :x-gap="16" :y-gap="16">
        <NGi v-for="project in projectStore.projects" :key="project.id">
          <NCard hoverable @click="handleProjectClick(project.id)">
            <template #header>{{ project.name }}</template>
            <p>{{ project.description || '暂无描述' }}</p>
            <template #footer>
              <span class="project-date">{{ new Date(project.createdAt).toLocaleDateString() }}</span>
            </template>
          </NCard>
        </NGi>
      </NGrid>
      <NEmpty v-else description="暂无项目" />
    </div>

    <NModal v-model:show="showCreateModal" preset="card" title="新建项目" style="width: 500px">
      <NForm :model="newProject">
        <NFormItem label="项目名称" path="name">
          <NInput v:value="newProject.name" placeholder="请输入项目名称" />
        </NFormItem>
        <NFormItem label="项目描述" path="description">
          <NInput v:value="newProject.description" type="textarea" placeholder="请输入项目描述（可选）" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit">创建</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.projects-container {
  min-height: 100vh;
  padding: 24px;
  background: #f5f5f5;
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.projects-header h1 {
  font-size: 24px;
  font-weight: 600;
}

.projects-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  min-height: 400px;
}

.project-date {
  font-size: 12px;
  color: #999;
}
</style>
