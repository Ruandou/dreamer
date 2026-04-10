<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NLayout, NLayoutSider, NMenu, NButton } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { useProjectStore } from '@/stores/project'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)

onMounted(async () => {
  if (projectId.value) {
    await projectStore.getProject(projectId.value)
  }
})

const menuOptions: MenuOption[] = [
  {
    label: 'AI编剧',
    key: 'script',
    onClick: () => router.push(`/project/${projectId.value}/script`)
  },
  {
    label: '角色库',
    key: 'characters',
    onClick: () => router.push(`/project/${projectId.value}/characters`)
  },
  {
    label: '分镜控制台',
    key: 'storyboard',
    onClick: () => router.push(`/project/${projectId.value}/storyboard`)
  },
  {
    label: '视频合成',
    key: 'compose',
    onClick: () => router.push(`/project/${projectId.value}/compose`)
  }
]

const currentMenu = computed(() => {
  const path = route.path
  if (path.includes('/script')) return 'script'
  if (path.includes('/characters')) return 'characters'
  if (path.includes('/storyboard')) return 'storyboard'
  if (path.includes('/compose')) return 'compose'
  return 'script'
})
</script>

<template>
  <NLayout has-sider style="height: 100vh">
    <NLayoutSider
      bordered
      :width="220"
      :native-scrollbar="false"
      style="background: #fff"
    >
      <div class="project-header">
        <h3>{{ projectStore.currentProject?.name || '项目' }}</h3>
        <NButton text @click="router.push('/projects')">
          ← 返回项目列表
        </NButton>
      </div>
      <NMenu
        v-model:value="currentMenu"
        :options="menuOptions"
      />
    </NLayoutSider>
    <NLayout content-style="padding: 24px; background: #f5f5f5;">
      <RouterView />
    </NLayout>
  </NLayout>
</template>

<style scoped>
.project-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.project-header h3 {
  margin-bottom: 8px;
  font-size: 16px;
}
</style>
