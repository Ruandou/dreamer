import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Scene, VideoTask } from '@dreamer/shared/types'
import { api } from '@/api'

// Extended Scene type with tasks (from API response)
export type SceneWithTasks = Scene & { tasks?: VideoTask[] }

export const useSceneStore = defineStore('scene', () => {
  const scenes = ref<Scene[]>([])
  const currentScene = ref<SceneWithTasks | null>(null)
  const isLoading = ref(false)
  const isGenerating = ref(false)

  async function fetchScenes(episodeId: string) {
    isLoading.value = true
    try {
      const res = await api.get<Scene[]>(`/scenes?episodeId=${episodeId}`)
      scenes.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function getScene(id: string) {
    const res = await api.get<Scene>(`/scenes/${id}`)
    currentScene.value = res.data
    return res.data
  }

  async function createScene(data: { episodeId: string; sceneNum: number; description?: string; prompt: string }) {
    const res = await api.post<Scene>('/scenes', data)
    scenes.value.push(res.data)
    scenes.value.sort((a, b) => a.sceneNum - b.sceneNum)
    return res.data
  }

  async function updateScene(id: string, data: { description?: string; prompt?: string; sceneNum?: number }) {
    const res = await api.put<Scene>(`/scenes/${id}`, data)
    const index = scenes.value.findIndex(s => s.id === id)
    if (index !== -1) {
      scenes.value[index] = res.data
    }
    if (currentScene.value?.id === id) {
      currentScene.value = res.data
    }
    return res.data
  }

  async function deleteScene(id: string) {
    await api.delete(`/scenes/${id}`)
    scenes.value = scenes.value.filter(s => s.id !== id)
    if (currentScene.value?.id === id) {
      currentScene.value = null
    }
  }

  async function reorderScenes(episodeId: string, sceneIds: string[]) {
    // Update scene numbers based on order
    const updates = sceneIds.map((id, index) =>
      updateScene(id, { sceneNum: index + 1 })
    )
    await Promise.all(updates)
    await fetchScenes(episodeId)
  }

  async function generateVideo(sceneId: string, model: 'wan2.6' | 'seedance2.0', referenceImage?: string, duration?: number) {
    isGenerating.value = true
    try {
      const res = await api.post<{ taskId: string; sceneId: string }>(`/scenes/${sceneId}/generate`, {
        model,
        referenceImage,
        duration
      })
      // Refresh scene to get updated tasks
      await getScene(sceneId)
      return res.data
    } finally {
      isGenerating.value = false
    }
  }

  async function batchGenerate(sceneIds: string[], model: 'wan2.6' | 'seedance2.0', referenceImage?: string) {
    isGenerating.value = true
    try {
      const res = await api.post<{ sceneId: string; taskId: string }[]>(`/scenes/batch-generate`, {
        sceneIds,
        model,
        referenceImage
      })
      return res.data
    } finally {
      isGenerating.value = false
    }
  }

  async function selectTask(sceneId: string, taskId: string) {
    const res = await api.post<VideoTask>(`/scenes/${sceneId}/tasks/${taskId}/select`)
    await getScene(sceneId)
    return res.data
  }

  async function optimizePrompt(sceneId: string, prompt?: string) {
    const res = await api.post<{ optimizedPrompt: string }>(`/scenes/${sceneId}/optimize-prompt`, { prompt })
    return res.data.optimizedPrompt
  }

  async function fetchTasks(sceneId: string) {
    const res = await api.get<VideoTask[]>(`/scenes/${sceneId}/tasks`)
    if (currentScene.value) {
      currentScene.value.tasks = res.data
    }
    return res.data
  }

  return {
    scenes,
    currentScene,
    isLoading,
    isGenerating,
    fetchScenes,
    getScene,
    createScene,
    updateScene,
    deleteScene,
    reorderScenes,
    generateVideo,
    batchGenerate,
    selectTask,
    optimizePrompt,
    fetchTasks
  }
})
