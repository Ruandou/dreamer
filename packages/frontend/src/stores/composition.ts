import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Composition, CompositionTimelineClip } from '@dreamer/shared/types'
import { api } from '@/api'

export const useCompositionStore = defineStore('composition', () => {
  const compositions = ref<Composition[]>([])
  const currentComposition = ref<Composition | null>(null)
  const isLoading = ref(false)
  const isExporting = ref(false)

  async function fetchCompositions(projectId: string) {
    isLoading.value = true
    try {
      const res = await api.get<Composition[]>(`/compositions?projectId=${projectId}`)
      compositions.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function getComposition(id: string) {
    isLoading.value = true
    try {
      const res = await api.get<Composition>(`/compositions/${id}`)
      currentComposition.value = res.data
      return res.data
    } finally {
      isLoading.value = false
    }
  }

  async function createComposition(projectId: string, episodeId: string, title: string) {
    const res = await api.post<Composition>('/compositions', { projectId, episodeId, title })
    compositions.value.unshift(res.data)
    return res.data
  }

  async function updateComposition(id: string, data: Partial<Composition>) {
    const res = await api.put<Composition>(`/compositions/${id}`, data)
    const index = compositions.value.findIndex((c) => c.id === id)
    if (index !== -1) {
      compositions.value[index] = res.data
    }
    if (currentComposition.value?.id === id) {
      currentComposition.value = res.data
    }
    return res.data
  }

  async function deleteComposition(id: string) {
    await api.delete(`/compositions/${id}`)
    compositions.value = compositions.value.filter((c) => c.id !== id)
    if (currentComposition.value?.id === id) {
      currentComposition.value = null
    }
  }

  async function updateTimeline(
    id: string,
    clips: Omit<CompositionTimelineClip, 'id' | 'compositionId'>[]
  ) {
    const res = await api.put<Composition>(`/compositions/${id}/timeline`, { clips })
    currentComposition.value = res.data
    return res.data
  }

  async function triggerExport(id: string) {
    isExporting.value = true
    try {
      const res = await api.post<{ message: string; outputUrl?: string; duration?: number }>(
        `/compositions/${id}/export`
      )
      await getComposition(id)
      return res.data
    } finally {
      isExporting.value = false
    }
  }

  return {
    compositions,
    currentComposition,
    isLoading,
    isExporting,
    fetchCompositions,
    getComposition,
    createComposition,
    updateComposition,
    deleteComposition,
    updateTimeline,
    triggerExport
  }
})
