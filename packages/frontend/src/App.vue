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
    primaryColor: '#f4726a',
    primaryColorHover: '#f8968e',
    primaryColorPressed: '#e85d55',
    primaryColorSuppl: '#f8968e',

    borderRadius: '10px',
    borderRadiusSmall: '8px',

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
    infoColor: '#60a5fa',

    // Text
    textColorBase: '#1e1b18',
    textColor1: '#1e1b18',
    textColor2: '#78716c',
    textColor3: '#a8a29e',

    // Background
    bodyColor: '#faf8f6',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',

    // Border
    borderColor: '#e7e5e4',
    dividerColor: '#e7e5e4'
  },
  Button: {
    fontWeight: '600',
    borderRadiusMedium: '10px',
    borderRadiusSmall: '8px',
    borderRadiusLarge: '12px'
  },
  Card: {
    borderRadius: '16px',
    paddingMedium: '24px',
    paddingLarge: '28px'
  },
  Input: {
    borderRadius: '10px'
  },
  Select: {
    borderRadius: '10px'
  },
  Modal: {
    borderRadius: '20px'
  },
  Menu: {
    itemBorderRadius: '10px',
    horizontalPadding: '16px',
    itemPadding: '0 14px'
  },
  Tag: {
    borderRadius: '9999px'
  },
  DataTable: {
    borderRadius: '16px',
    thPadding: '14px 18px',
    tdPadding: '14px 18px'
  },
  Tabs: {
    tabTextColorLine: '#78716c',
    tabTextColorActiveLine: '#f4726a',
    tabTextColorHoverLine: '#f8968e'
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
