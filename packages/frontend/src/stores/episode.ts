import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Episode, ScriptContent } from '@dreamer/shared/types'
import { api } from '@/api'

export const useEpisodeStore = defineStore('episode', () => {
  const episodes = ref<Episode[]>([])
  const currentEpisode = ref<Episode | null>(null)
  const isLoading = ref(false)
  const isExpanding = ref(false)

  async function fetchEpisodes(projectId: string) {
    isLoading.value = true
    try {
      const res = await api.get<Episode[]>(`/episodes?projectId=${projectId}`)
      episodes.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function getEpisode(id: string) {
    isLoading.value = true
    try {
      const res = await api.get<Episode>(`/episodes/${id}`)
      currentEpisode.value = res.data
      return res.data
    } finally {
      isLoading.value = false
    }
  }

  async function createEpisode(data: { projectId: string; episodeNum: number; title?: string }) {
    const res = await api.post<Episode>('/episodes', data)
    episodes.value.unshift(res.data)
    return res.data
  }

  async function updateEpisode(
    id: string,
    data: { title?: string; synopsis?: string | null; rawScript?: ScriptContent; script?: ScriptContent }
  ) {
    const payload: { title?: string; synopsis?: string | null; rawScript?: ScriptContent } = {}
    if (data.title !== undefined) payload.title = data.title
    if (data.synopsis !== undefined) payload.synopsis = data.synopsis
    const scriptBody = data.rawScript ?? data.script
    if (scriptBody !== undefined) payload.rawScript = scriptBody
    const res = await api.put<Episode>(`/episodes/${id}`, payload)
    const index = episodes.value.findIndex(e => e.id === id)
    if (index !== -1) {
      episodes.value[index] = res.data
    }
    if (currentEpisode.value?.id === id) {
      currentEpisode.value = res.data
    }
    return res.data
  }

  async function deleteEpisode(id: string) {
    await api.delete(`/episodes/${id}`)
    episodes.value = episodes.value.filter(e => e.id !== id)
    if (currentEpisode.value?.id === id) {
      currentEpisode.value = null
    }
  }

  async function expandScript(episodeId: string, summary: string) {
    isExpanding.value = true
    try {
      const res = await api.post<{
        episode: Episode
        script: ScriptContent
        scenesCreated: number
      }>(`/episodes/${episodeId}/expand`, { summary })
      currentEpisode.value = res.data.episode
      return res.data
    } finally {
      isExpanding.value = false
    }
  }

  return {
    episodes,
    currentEpisode,
    isLoading,
    isExpanding,
    fetchEpisodes,
    getEpisode,
    createEpisode,
    updateEpisode,
    deleteEpisode,
    expandScript
  }
})
