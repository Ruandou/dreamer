import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Character } from '@shared/types'
import { api } from '@/api'

export const useCharacterStore = defineStore('character', () => {
  const characters = ref<Character[]>([])
  const isLoading = ref(false)

  async function fetchCharacters(projectId: string) {
    isLoading.value = true
    try {
      const res = await api.get<Character[]>(`/characters?projectId=${projectId}`)
      characters.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function getCharacter(id: string) {
    const res = await api.get<Character>(`/characters/${id}`)
    return res.data
  }

  async function createCharacter(data: { projectId: string; name: string; description?: string }) {
    const res = await api.post<Character>('/characters', data)
    characters.value.unshift(res.data)
    return res.data
  }

  async function updateCharacter(id: string, data: Partial<Character>) {
    const res = await api.put<Character>(`/characters/${id}`, data)
    const index = characters.value.findIndex(c => c.id === id)
    if (index !== -1) {
      characters.value[index] = res.data
    }
    return res.data
  }

  async function deleteCharacter(id: string) {
    await api.delete(`/characters/${id}`)
    characters.value = characters.value.filter(c => c.id !== id)
  }

  async function uploadAvatar(characterId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const res = await api.post<Character>(
      `/characters/${characterId}/avatar`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    )

    const index = characters.value.findIndex(c => c.id === characterId)
    if (index !== -1) {
      characters.value[index] = res.data
    }
    return res.data
  }

  async function uploadVersion(characterId: string, file: File, name: string, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    if (description) {
      formData.append('description', description)
    }

    const res = await api.post<Character>(
      `/characters/${characterId}/versions`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    )

    const index = characters.value.findIndex(c => c.id === characterId)
    if (index !== -1) {
      characters.value[index] = res.data
    }
    return res.data
  }

  return {
    characters,
    isLoading,
    fetchCharacters,
    getCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    uploadAvatar,
    uploadVersion
  }
})
