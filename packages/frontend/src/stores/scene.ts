import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Take, SceneStatus } from '@dreamer/shared/types'
import { api } from '@/api'

/** 后端返回的场次（含 takes） */
export type SceneRow = {
  id: string
  episodeId: string
  sceneNum: number
  description: string
  status: SceneStatus
  takes?: Take[]
  shots?: unknown[]
}

export type SceneWithTakes = SceneRow

/** GET /episodes/:id/scenes 聚合结构 */
export type EpisodeEditorScene = {
  id: string
  episodeId: string
  sceneNum: number
  description: string
  duration: number
  status: SceneStatus
  location: { id: string; name: string; imageUrl?: string | null } | null
  shots: Array<{
    id: string
    shotNum: number
    order: number
    description: string
    cameraAngle?: string | null
    cameraMovement?: string | null
    duration: number
    characterShots: Array<{
      id: string
      action?: string | null
      characterImage: {
        id: string
        name: string
        avatarUrl?: string | null
        character: { id: string; name: string }
      }
    }>
  }>
  dialogues: Array<{
    id: string
    order: number
    startTimeMs: number
    durationMs: number
    text: string
    voiceConfig: unknown
    character: { id: string; name: string }
  }>
  takes: Take[]
}

export const useSceneStore = defineStore('scene', () => {
  const scenes = ref<SceneRow[]>([])
  /** 分集管理页专用（含 shots / dialogues） */
  const editorScenes = ref<EpisodeEditorScene[]>([])
  const currentScene = ref<SceneWithTakes | null>(null)
  const isLoading = ref(false)
  const isGenerating = ref(false)

  async function fetchEpisodeScenesDetail(episodeId: string) {
    isLoading.value = true
    try {
      const res = await api.get<{ scenes: EpisodeEditorScene[] }>(`/episodes/${episodeId}/scenes`)
      editorScenes.value = res.data.scenes
      scenes.value = res.data.scenes.map((s) => ({
        id: s.id,
        episodeId: s.episodeId,
        sceneNum: s.sceneNum,
        description: s.description,
        status: s.status,
        takes: s.takes
      }))
    } finally {
      isLoading.value = false
    }
  }

  async function fetchScenes(episodeId: string) {
    isLoading.value = true
    try {
      const res = await api.get<SceneRow[]>(`/scenes?episodeId=${episodeId}`)
      scenes.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function getScene(id: string) {
    const res = await api.get<SceneRow>(`/scenes/${id}`)
    currentScene.value = res.data
    return res.data
  }

  async function createScene(data: { episodeId: string; sceneNum: number; description?: string; prompt: string }) {
    const res = await api.post<SceneRow>('/scenes', data)
    scenes.value.push(res.data)
    scenes.value.sort((a, b) => a.sceneNum - b.sceneNum)
    return res.data
  }

  async function updateScene(id: string, data: { description?: string; sceneNum?: number; prompt?: string }) {
    const res = await api.put<SceneRow>(`/scenes/${id}`, data)
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
    const updates = sceneIds.map((id, index) =>
      updateScene(id, { sceneNum: index + 1 })
    )
    await Promise.all(updates)
    await fetchScenes(episodeId)
  }

  async function generateVideo(sceneId: string, model: 'wan2.6' | 'seedance2.0', options?: {
    referenceImage?: string
    imageUrls?: string[]
    duration?: number
  }) {
    isGenerating.value = true
    try {
      const res = await api.post<{ taskId: string; sceneId: string }>(`/scenes/${sceneId}/generate`, {
        model,
        referenceImage: options?.referenceImage,
        imageUrls: options?.imageUrls,
        duration: options?.duration
      })
      await getScene(sceneId)
      return res.data
    } finally {
      isGenerating.value = false
    }
  }

  async function batchGenerate(sceneIds: string[], model: 'wan2.6' | 'seedance2.0', options?: {
    referenceImage?: string
    imageUrls?: string[]
  }) {
    isGenerating.value = true
    try {
      const res = await api.post<{ sceneId: string; taskId: string }[]>(`/scenes/batch-generate`, {
        sceneIds,
        model,
        referenceImage: options?.referenceImage,
        imageUrls: options?.imageUrls
      })
      return res.data
    } finally {
      isGenerating.value = false
    }
  }

  async function selectTask(sceneId: string, taskId: string) {
    const res = await api.post<Take>(`/scenes/${sceneId}/tasks/${taskId}/select`)
    await getScene(sceneId)
    return res.data
  }

  async function optimizePrompt(sceneId: string, prompt?: string) {
    const res = await api.post<{ optimizedPrompt: string }>(`/scenes/${sceneId}/optimize-prompt`, { prompt })
    return res.data.optimizedPrompt
  }

  async function fetchTasks(sceneId: string) {
    const res = await api.get<Take[]>(`/scenes/${sceneId}/tasks`)
    if (currentScene.value) {
      currentScene.value.takes = res.data
    }
    return res.data
  }

  return {
    scenes,
    editorScenes,
    currentScene,
    isLoading,
    isGenerating,
    fetchEpisodeScenesDetail,
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
