<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, darkTheme, lightTheme } from 'naive-ui'
import { RouterView, useRouter } from 'vue-router'
import { useSSE } from '@/composables/useSSE'

const router = useRouter()
const isDark = ref(false)
const { connected, connect, disconnect } = useSSE()

// Watch for token changes to connect/disconnect SSE
watch(() => localStorage.getItem('token'), (token) => {
  if (token) {
    connect()
  } else {
    disconnect()
  }
}, { immediate: true })

onMounted(() => {
  const token = localStorage.getItem('token')
  if (token) {
    connect()
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
          <RouterView />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
