<template>
  <NLayout has-sider class="dashboard-layout">
    <!-- 左侧边栏（由路由 meta 决定内容） -->
    <AppSidebar :mode="sidebarMode" :menu-options="projectMenuOptions" :breadcrumbs="breadcrumbs" />

    <!-- 右侧内容区（无 Header，直接贴顶） -->
    <NLayout class="dashboard-main">
      <NLayoutContent class="dashboard-content">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NLayout, NLayoutContent } from 'naive-ui'
import AppSidebar from '../components/AppSidebar.vue'
import type { BreadcrumbItem } from '../components/SidebarBreadcrumb.vue'
import { useProjectStore } from '../stores/project'

const route = useRoute()
const projectStore = useProjectStore()

// 根据路由 meta 决定侧边栏模式
const sidebarMode = computed(() => (route.meta.projectLayout ? 'project' : 'global'))

// 项目模式下的面包屑
const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  if (sidebarMode.value !== 'project') return []

  const projectId = route.params.id as string
  const projectName = projectStore.currentProject?.name || '项目'
  const crumbs: BreadcrumbItem[] = [{ label: projectName, path: `/project/${projectId}` }]

  // 添加当前路由的面包屑
  for (const matched of route.matched) {
    if (matched.meta?.title && matched.path !== `/project/:id`) {
      crumbs.push({
        label: matched.meta.title as string,
        path: matched.path.includes(':') ? undefined : matched.path
      })
    }
  }

  return crumbs
})

// 项目模式下的菜单选项（由 ProjectDetail 提供）
const projectMenuOptions = computed(() => {
  // 这部分将由 ProjectDetail 通过 provide/inject 或其他方式提供
  // 暂时返回空数组，后续在 ProjectDetail 改造时补充
  return []
})
</script>

<style scoped>
.dashboard-layout {
  height: 100vh;
}

.dashboard-main {
  background: #f5f5f5;
}

.dashboard-content {
  overflow: hidden;
}
</style>
