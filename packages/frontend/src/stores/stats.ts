import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export interface ProjectCostStats {
  projectId: string
  projectName: string
  totalCost: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  tasksByModel: {
    wan2dot6: { count: number; cost: number }
    seedance2dot0: { count: number; cost: number }
  }
  recentTasks: Array<{
    id: string
    model: string
    cost: number
    status: string
    createdAt: string
  }>
}

export interface UserCostStats {
  userId: string
  totalCost: number
  totalProjects: number
  totalTasks: number
  projects: ProjectCostStats[]
}

export const useStatsStore = defineStore('stats', () => {
  const userStats = ref<UserCostStats | null>(null)
  const projectStats = ref<ProjectCostStats | null>(null)
  const dailyTrend = ref<Array<{ date: string; wanCost: number; seedanceCost: number; total: number }>>([])
  const isLoading = ref(false)

  async function fetchUserStats() {
    isLoading.value = true
    try {
      const res = await api.get<UserCostStats>('/stats/me')
      userStats.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProjectStats(projectId: string) {
    isLoading.value = true
    try {
      const res = await api.get<ProjectCostStats>(`/stats/projects/${projectId}`)
      projectStats.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchDailyTrend(projectId?: string, days = 30) {
    const query = projectId
      ? `/stats/trend?projectId=${projectId}&days=${days}`
      : `/stats/trend?days=${days}`
    const res = await api.get<typeof dailyTrend.value>(query)
    dailyTrend.value = res.data
  }

  return {
    userStats,
    projectStats,
    dailyTrend,
    isLoading,
    fetchUserStats,
    fetchProjectStats,
    fetchDailyTrend
  }
})
