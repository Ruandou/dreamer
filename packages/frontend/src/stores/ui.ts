import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export const useUIStore = defineStore('ui', () => {
  // 侧边栏状态
  const sidebarCollapsed = ref(localStorage.getItem('sidebarCollapsed') === 'true')

  // 深色模式
  const isDark = ref(localStorage.getItem('isDark') === 'true')

  // 用户信息
  const userName = ref('')
  const userEmail = ref('')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed.value))
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('isDark', String(isDark.value))
  }

  async function fetchUserInfo() {
    try {
      const user = await api.get('/auth/me')
      userName.value = user.name || ''
      userEmail.value = user.email || ''
    } catch {
      // 静默失败
    }
  }

  return {
    sidebarCollapsed,
    isDark,
    userName,
    userEmail,
    toggleSidebar,
    toggleTheme,
    fetchUserInfo
  }
})
