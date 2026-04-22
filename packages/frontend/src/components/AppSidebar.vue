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
        <span class="logo-icon">🎭</span>
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
import { NLayoutSider, NMenu, type MenuOption } from 'naive-ui'
import { useUIStore } from '../stores/ui'

const router = useRouter()
const route = useRoute()
const uiStore = useUIStore()

const currentRoute = computed(() => route.path)

const menuOptions: MenuOption[] = [
  { label: '工作台', key: '/dashboard', icon: () => h('span', {}, '🏠') },
  { label: '项目列表', key: '/projects', icon: () => h('span', {}, '📁') },
  { label: '剧本列表', key: '/scripts', icon: () => h('span', {}, '📜') },
  { label: 'AI 写作工作室', key: '/studio', icon: () => h('span', {}, '✍️') },
  { label: '导入剧本', key: '/import', icon: () => h('span', {}, '📥') },
  { label: '任务中心', key: '/jobs', icon: () => h('span', {}, '⏳') },
  { label: '统计分析', key: '/stats', icon: () => h('span', {}, '📊') },
  { label: '模型日志', key: '/model-calls', icon: () => h('span', {}, '📡') },
  { label: '设置', key: '/settings', icon: () => h('span', {}, '⚙️') }
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
  font-size: 24px;
  flex-shrink: 0;
}

.logo-text {
  white-space: nowrap;
  overflow: hidden;
}
</style>
