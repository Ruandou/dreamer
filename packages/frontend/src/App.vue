<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, darkTheme, NButton, NDropdown, NAvatar } from 'naive-ui'
import { RouterView, useRouter } from 'vue-router'
import { useSSE } from '@/composables/useSSE'
import { api } from '@/api'

const router = useRouter()
const isDark = ref(false)
const isLoggedIn = ref(!!localStorage.getItem('token'))

// SSE will be initialized after mount to ensure providers are ready
let sseConnect: (() => void) | null = null
let sseDisconnect: (() => void) | null = null

// 用户信息
const userName = ref('')
const userMenuOptions = ref([
  {
    label: '退出登录',
    key: 'logout'
  }
])

const handleUserMenuSelect = (key: string) => {
  if (key === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    isLoggedIn.value = false
    router.push('/login')
  }
}

// 获取用户信息
const fetchUserInfo = async () => {
  try {
    const res = await api.get('/settings/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    if (res.data?.user) {
      userName.value = res.data.user.name
    }
  } catch (e) {
    // ignore
  }
}

// Watch for token changes to connect/disconnect SSE
watch(() => localStorage.getItem('token'), (token) => {
  isLoggedIn.value = !!token
  if (token && sseConnect) {
    sseConnect()
  } else if (!token && sseDisconnect) {
    sseDisconnect()
  }
})

onMounted(() => {
  // Initialize SSE after providers are mounted
  const sse = useSSE()
  sseConnect = sse.connect
  sseDisconnect = sse.disconnect

  const token = localStorage.getItem('token')
  if (token) {
    sseConnect()
    fetchUserInfo()
  }
})

const themeOverrides = {
  common: {
    primaryColor: '#6366f1',
    primaryColorHover: '#818cf8',
    primaryColorPressed: '#4f46e5',
    primaryColorSuppl: '#818cf8',

    borderRadius: '8px',
    borderRadiusSmall: '6px',

    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyMono: '"Fira Code", monospace',

    // Spacing
    paddingLarge: '24px',
    paddingMedium: '16px',
    paddingSmall: '12px',

    // Colors
    successColor: '#10b981',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    infoColor: '#3b82f6',

    // Text
    textColorBase: '#111827',
    textColor1: '#111827',
    textColor2: '#6b7280',
    textColor3: '#9ca3af',

    // Background
    bodyColor: '#f5f5f5',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',

    // Border
    borderColor: '#e5e7eb',
    dividerColor: '#e5e7eb',
  },
  Button: {
    fontWeight: '500',
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px',
    borderRadiusLarge: '10px',
  },
  Card: {
    borderRadius: '12px',
    paddingMedium: '20px',
    paddingLarge: '24px',
  },
  Input: {
    borderRadius: '8px',
  },
  Select: {
    borderRadius: '8px',
  },
  Modal: {
    borderRadius: '16px',
  },
  Menu: {
    itemBorderRadius: '8px',
    horizontalPadding: '16px',
    itemPadding: '0 12px',
  },
  Tag: {
    borderRadius: '9999px',
  },
  DataTable: {
    borderRadius: '12px',
    thPadding: '12px 16px',
    tdPadding: '12px 16px',
  },
  Tabs: {
    tabTextColorLine: '#6b7280',
    tabTextColorActiveLine: '#6366f1',
    tabTextColorHoverLine: '#818cf8',
  }
}
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : undefined" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <div class="app-shell">
            <!-- 顶部导航栏：高度参与 flex，避免子页再写 100vh 造成双滚动条 -->
            <header v-if="isLoggedIn" class="app-header">
              <div class="app-header-left">
                <h2 @click="router.push('/projects')" class="app-logo">🎭 AI短剧工作台</h2>
              </div>
              <div class="app-header-right">
                <NDropdown :options="userMenuOptions" @select="handleUserMenuSelect">
                  <NButton quaternary size="large" style="display: flex; align-items: center; gap: 8px;">
                    <NAvatar round size="small" :style="{ backgroundColor: '#6366f1', flexShrink: 0 }">
                      {{ userName ? userName.charAt(0).toUpperCase() : '?' }}
                    </NAvatar>
                    {{ userName || '用户' }}
                    <span style="opacity: 0.5; font-size: 12px;">▾</span>
                  </NButton>
                </NDropdown>
              </div>
            </header>
            <main class="app-main">
              <RouterView />
            </main>
          </div>
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  z-index: 100;
}

.app-header-left {
  display: flex;
  align-items: center;
}

.app-logo {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  margin: 0;
}

.app-header-right {
  display: flex;
  align-items: center;
}
</style>
