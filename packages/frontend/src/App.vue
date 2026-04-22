<script setup lang="ts">
import { watch, onMounted } from 'vue'
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  darkTheme
} from 'naive-ui'
import { RouterView } from 'vue-router'
import { useSSE } from '@/composables/useSSE'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()

// SSE will be initialized after mount to ensure providers are ready
let sseConnect: (() => void) | null = null
let sseDisconnect: (() => void) | null = null

// Watch for token changes to connect/disconnect SSE
watch(
  () => localStorage.getItem('token'),
  (token) => {
    if (token && sseConnect) {
      sseConnect()
    } else if (!token && sseDisconnect) {
      sseDisconnect()
    }
  }
)

onMounted(() => {
  // Initialize SSE after providers are mounted
  const sse = useSSE()
  sseConnect = sse.connect
  sseDisconnect = sse.disconnect

  const token = localStorage.getItem('token')
  if (token) {
    sseConnect()
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
    dividerColor: '#e5e7eb'
  },
  Button: {
    fontWeight: '500',
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px',
    borderRadiusLarge: '10px'
  },
  Card: {
    borderRadius: '12px',
    paddingMedium: '20px',
    paddingLarge: '24px'
  },
  Input: {
    borderRadius: '8px'
  },
  Select: {
    borderRadius: '8px'
  },
  Modal: {
    borderRadius: '16px'
  },
  Menu: {
    itemBorderRadius: '8px',
    horizontalPadding: '16px',
    itemPadding: '0 12px'
  },
  Tag: {
    borderRadius: '9999px'
  },
  DataTable: {
    borderRadius: '12px',
    thPadding: '12px 16px',
    tdPadding: '12px 16px'
  },
  Tabs: {
    tabTextColorLine: '#6b7280',
    tabTextColorActiveLine: '#6366f1',
    tabTextColorHoverLine: '#818cf8'
  }
}
</script>

<template>
  <NConfigProvider
    :theme="uiStore.isDark ? darkTheme : undefined"
    :theme-overrides="themeOverrides"
  >
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <RouterView />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
