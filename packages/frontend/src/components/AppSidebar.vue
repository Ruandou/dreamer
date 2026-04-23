<template>
  <NLayoutSider
    bordered
    collapse-mode="width"
    :collapsed-width="64"
    :width="220"
    :collapsed="uiStore.sidebarCollapsed"
    show-trigger
    @collapse="uiStore.toggleSidebar()"
    @expand="uiStore.toggleSidebar()"
    class="app-sider"
  >
    <div class="sider-content">
      <!-- Logo -->
      <div class="sider-logo">
        <span class="logo-icon">
          <NIcon :component="CreateOutline" :size="24" />
        </span>
        <span v-if="!uiStore.sidebarCollapsed" class="logo-text">AI短剧工作台</span>
      </div>

      <!-- Menu -->
      <NMenu
        :value="currentRoute"
        :collapsed="uiStore.sidebarCollapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        @update:value="handleMenuClick"
      />
    </div>
  </NLayoutSider>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NLayoutSider, NMenu, NIcon, type MenuOption } from 'naive-ui'
import {
  HomeOutline,
  FolderOpenOutline,
  DocumentTextOutline,
  CreateOutline,
  DownloadOutline,
  TimeOutline,
  BarChartOutline,
  RadioOutline,
  SettingsOutline
} from '@vicons/ionicons5'
import { useUIStore } from '../stores/ui'

const router = useRouter()
const route = useRoute()
const uiStore = useUIStore()

const currentRoute = computed(() => route.path)

function renderIcon(component: any) {
  return () => h(NIcon, { component, size: 20 })
}

const menuOptions: MenuOption[] = [
  { label: '工作台', key: '/dashboard', icon: renderIcon(HomeOutline) },
  { label: '项目列表', key: '/projects', icon: renderIcon(FolderOpenOutline) },
  { label: '剧本列表', key: '/scripts', icon: renderIcon(DocumentTextOutline) },
  { label: 'AI 写作工作室', key: '/studio', icon: renderIcon(CreateOutline) },
  { label: '导入剧本', key: '/import', icon: renderIcon(DownloadOutline) },
  { label: '任务中心', key: '/jobs', icon: renderIcon(TimeOutline) },
  { label: '统计分析', key: '/stats', icon: renderIcon(BarChartOutline) },
  { label: '模型日志', key: '/model-calls', icon: renderIcon(RadioOutline) },
  { label: '设置', key: '/settings', icon: renderIcon(SettingsOutline) }
]

function handleMenuClick(key: string) {
  router.push(key)
}
</script>

<style scoped>
.app-sider {
  background: var(--color-bg-white);
  z-index: 10;
}

.sider-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 8px;
}

.sider-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--color-primary-light);
  color: var(--color-primary);
  flex-shrink: 0;
}

.logo-text {
  white-space: nowrap;
  overflow: hidden;
}
</style>
