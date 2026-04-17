import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getUserStats,
  getProjectStats,
  getCostTrend,
  type UserCostStats,
  type ProjectCostStats,
  type DailyCost
} from '@/api'

export const useStatsStore = defineStore('stats', () => {
  const userStats = ref<UserCostStats | null>(null)
  const projectStats = ref<ProjectCostStats | null>(null)
  const dailyCosts = ref<DailyCost[]>([])
  const isLoading = ref(false)

  async function fetchUserStats() {
    isLoading.value = true
    try {
      userStats.value = await getUserStats()
    } finally {
      isLoading.value = false
    }
  }

  async function fetchProjectStats(projectId: string) {
    isLoading.value = true
    try {
      projectStats.value = await getProjectStats(projectId)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchCostTrend(projectId?: string, days: number = 30) {
    isLoading.value = true
    try {
      dailyCosts.value = await getCostTrend(projectId, days)
    } finally {
      isLoading.value = false
    }
  }

  return {
    userStats,
    projectStats,
    dailyCosts,
    isLoading,
    fetchUserStats,
    fetchProjectStats,
    fetchCostTrend
  }
})
