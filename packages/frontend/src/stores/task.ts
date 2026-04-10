import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VideoTask } from '@dreamer/shared/types'
import { api } from '@/api'

export const useTaskStore = defineStore('task', () => {
  const currentTask = ref<VideoTask | null>(null)
  const isLoading = ref(false)

  async function fetchTask(taskId: string) {
    isLoading.value = true
    try {
      const res = await api.get<VideoTask>(`/tasks/${taskId}`)
      currentTask.value = res.data
      return res.data
    } finally {
      isLoading.value = false
    }
  }

  async function cancelTask(taskId: string) {
    const res = await api.post<VideoTask>(`/tasks/${taskId}/cancel`)
    if (currentTask.value?.id === taskId) {
      currentTask.value = res.data
    }
    return res.data
  }

  async function retryTask(taskId: string) {
    const res = await api.post<VideoTask>(`/tasks/${taskId}/retry`)
    return res.data
  }

  async function fetchProjectTasks(projectId: string) {
    const res = await api.get<VideoTask[]>(`/tasks?projectId=${projectId}`)
    return res.data
  }

  return {
    currentTask,
    isLoading,
    fetchTask,
    cancelTask,
    retryTask,
    fetchProjectTasks
  }
})
