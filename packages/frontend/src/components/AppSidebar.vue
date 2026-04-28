<script setup lang="ts">
import { computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NLayoutSider,
  NMenu,
  NIcon,
  NButton,
  NAvatar,
  NDropdown,
  type MenuOption,
  type DropdownOption
} from 'naive-ui'
import {
  HomeOutline,
  FolderOpenOutline,
  DocumentTextOutline,
  CreateOutline,
  TimeOutline,
  BarChartOutline,
  RadioOutline,
  SettingsOutline
} from '@vicons/ionicons5'
import { useUIStore } from '../stores/ui'
import SidebarBreadcrumb, { type BreadcrumbItem } from './SidebarBreadcrumb.vue'
import { NAV_ICONS } from '../lib/nav-icons'

export interface AppSidebarProps {
  mode?: 'global' | 'project'
  menuOptions?: MenuOption[]
  breadcrumbs?: BreadcrumbItem[]
}

const props = withDefaults(defineProps<AppSidebarProps>(), {
  mode: 'global',
  menuOptions: () => [],
  breadcrumbs: () => []
})

const router = useRouter()
const route = useRoute()
const uiStore = useUIStore()

const currentRoute = computed(() => route.path)

function renderIcon(component: any) {
  return () => h(NIcon, { component, size: 20 })
}

const globalMenuOptions: MenuOption[] = [
  { label: '工作台', key: '/dashboard', icon: renderIcon(HomeOutline) },
  { label: '项目列表', key: '/projects', icon: renderIcon(FolderOpenOutline) },
  { label: '剧本列表', key: '/scripts', icon: renderIcon(DocumentTextOutline) },
  { label: 'AI 写剧本', key: '/studio', icon: renderIcon(CreateOutline) },
  { label: 'AI 剧本编辑器', key: '/editor', icon: renderIcon(CreateOutline) },
  { label: '任务中心', key: '/jobs', icon: renderIcon(TimeOutline) },
  { label: '统计分析', key: '/stats', icon: renderIcon(BarChartOutline) },
  { label: '模型日志', key: '/model-calls', icon: renderIcon(RadioOutline) },
  { label: '设置', key: '/settings', icon: renderIcon(SettingsOutline) }
]

const menuOptions = computed(() =>
  props.mode === 'global' ? globalMenuOptions : props.menuOptions
)
const activeKey = computed(() => {
  if (props.mode === 'global') return currentRoute.value
  // 项目模式：匹配当前路径到菜单项的 key
  return currentRoute.value ?? undefined
})

function handleMenuClick(key: string) {
  router.push(key)
}

const userName = computed(() => uiStore.userName)
const userMenuOptions: DropdownOption[] = [{ label: '退出登录', key: 'logout' }]

function handleUserMenu(key: string) {
  if (key === 'logout') {
    localStorage.removeItem('token')
    router.push('/login')
  }
}
</script>

<template>
  <NLayoutSider
    bordered
    collapse-mode="width"
    :collapsed-width="64"
    :width="260"
    :collapsed="uiStore.sidebarCollapsed"
    show-trigger
    @collapse="uiStore.toggleSidebar()"
    @expand="uiStore.toggleSidebar()"
    class="app-sider"
    :data-collapsed="uiStore.sidebarCollapsed"
  >
    <div class="sider-content">
      <!-- Logo -->
      <div class="sider-logo" @click="router.push('/dashboard')">
        <img src="/images/dreamer-logo.png" alt="Dreamer" class="logo-img" />
        <span v-if="!uiStore.sidebarCollapsed" class="logo-text">AI短剧工作台</span>
      </div>

      <!-- 项目面包屑（仅 project 模式） -->
      <SidebarBreadcrumb
        v-if="mode === 'project' && breadcrumbs.length > 0"
        :crumbs="breadcrumbs"
      />

      <!-- 返回按钮（仅 project 模式） -->
      <div v-if="mode === 'project' && !uiStore.sidebarCollapsed" class="sidebar-back">
        <NButton text size="small" @click="router.push('/projects')">
          <template #icon>
            <NIcon :component="NAV_ICONS.back" :size="16" />
          </template>
          返回工作台
        </NButton>
      </div>

      <!-- 导航菜单 -->
      <NMenu
        :value="activeKey"
        :collapsed="uiStore.sidebarCollapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        @update:value="handleMenuClick"
      />

      <!-- 底部用户区 -->
      <div class="sidebar-footer">
        <NDropdown :options="userMenuOptions" @select="handleUserMenu" placement="top-start">
          <div class="user-section">
            <NAvatar round size="medium" :style="{ backgroundColor: '#6366f1' }">
              {{ userName.charAt(0) || 'U' }}
            </NAvatar>
            <span v-if="!uiStore.sidebarCollapsed" class="user-name">{{ userName }}</span>
          </div>
        </NDropdown>
      </div>
    </div>
  </NLayoutSider>
</template>

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
  justify-content: flex-start;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.sider-logo:hover {
  background: var(--color-bg-gray);
}

.app-sider[data-collapsed='true'] .sider-logo {
  justify-content: center;
  padding: 12px 0;
}

.logo-img {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  object-fit: cover;
}

.app-sider[data-collapsed='true'] .logo-img {
  width: 36px;
  height: 36px;
}

.logo-text {
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-back {
  padding: 4px 16px 12px;
  border-bottom: 1px solid var(--color-border-light);
}

/* 底部用户区 */
.sidebar-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-white);
}

.app-sider[data-collapsed='true'] .sidebar-footer {
  padding: 12px 0;
  display: flex;
  justify-content: center;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.app-sider[data-collapsed='true'] .user-section {
  padding: 4px;
  justify-content: center;
}

.user-section:hover {
  background: var(--color-bg-gray);
}

.user-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-section :deep(.n-avatar) {
  flex-shrink: 0;
}

/* Override Naive UI menu styles for warmer look */
.app-sider :deep(.n-menu .n-menu-item-content) {
  border-radius: 10px;
  margin: 2px 8px;
  transition: all 0.2s ease;
}

.app-sider :deep(.n-menu .n-menu-item-content--selected) {
  background: linear-gradient(135deg, #ffeaea 0%, #ffedd5 100%) !important;
  color: #e85d55 !important;
  font-weight: 600;
}

.app-sider :deep(.n-menu .n-menu-item-content--selected .n-menu-item-content__icon) {
  color: #f4726a !important;
}

.app-sider :deep(.n-menu .n-menu-item-content:hover) {
  background: var(--color-bg-gray);
}

.app-sider :deep(.n-menu .n-menu-item-content--selected:hover) {
  background: linear-gradient(135deg, #ffeaea 0%, #ffedd5 100%) !important;
}

/* Collapsed sidebar: center all icons */
.app-sider[data-collapsed='true'] :deep(.n-menu .n-menu-item-content) {
  display: flex !important;
  justify-content: center !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.app-sider[data-collapsed='true'] :deep(.n-menu .n-menu-item-content__icon) {
  margin-right: 0 !important;
  margin-left: 0 !important;
}

.app-sider[data-collapsed='true'] :deep(.n-menu .n-menu-item-content-header) {
  display: none !important;
}
</style>
