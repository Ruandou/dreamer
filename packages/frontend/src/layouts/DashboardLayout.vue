<template>
  <NLayout has-sider class="dashboard-layout">
    <!-- 左侧边栏 -->
    <AppSidebar />

    <!-- 右侧内容区 -->
    <NLayout class="dashboard-main">
      <!-- 顶栏 -->
      <NLayoutHeader class="dashboard-header">
        <div class="header-content">
          <div class="header-left"></div>
          <div class="header-right">
            <NDropdown :options="userMenuOptions" @select="handleUserMenu">
              <NButton quaternary class="user-button">
                <NAvatar round size="small" :style="{ backgroundColor: '#6366f1' }">
                  {{ userName.charAt(0) || 'U' }}
                </NAvatar>
                <span class="user-name">{{ userName }}</span>
              </NButton>
            </NDropdown>
          </div>
        </div>
      </NLayoutHeader>

      <!-- 内容区 -->
      <NLayoutContent class="dashboard-content">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NButton,
  NAvatar,
  NDropdown,
  type DropdownOption
} from 'naive-ui'
import { useUIStore } from '../stores/ui'
import AppSidebar from '../components/AppSidebar.vue'

const router = useRouter()
const uiStore = useUIStore()

const userName = computed(() => uiStore.userName)

onMounted(() => {
  uiStore.fetchUserInfo()
})

const userMenuOptions: DropdownOption[] = [{ label: '退出登录', key: 'logout' }]

function handleUserMenu(key: string) {
  if (key === 'logout') {
    localStorage.removeItem('token')
    router.push('/login')
  }
}
</script>

<style scoped>
.dashboard-layout {
  height: 100vh;
}

.dashboard-main {
  background: #f5f5f5;
}

.dashboard-header {
  background: var(--color-bg-white);
  border-bottom: 1px solid #e5e7eb;
  height: 56px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 24px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 14px;
  color: var(--color-text-primary);
}

.dashboard-content {
  overflow-y: auto;
}
</style>
