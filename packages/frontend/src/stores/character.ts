import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Character, CharacterImage } from '@shared/types'
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

  // Image management
  async function addImage(characterId: string, file: File, name: string, parentId?: string, type?: string, description?: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    if (parentId) formData.append('parentId', parentId)
    if (type) formData.append('type', type)
    if (description) formData.append('description', description)

    const res = await api.post<CharacterImage>(
      `/characters/${characterId}/images`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )

    // Refresh character to get updated images
    await fetchCharacters(characters.value.find(c => c.id === characterId)?.projectId || '')
    return res.data
  }

  async function updateImage(characterId: string, imageId: string, data: Partial<CharacterImage>) {
    const res = await api.put<CharacterImage>(`/characters/${characterId}/images/${imageId}`, data)
    await fetchCharacters(characters.value.find(c => c.id === characterId)?.projectId || '')
    return res.data
  }

  async function deleteImage(characterId: string, imageId: string) {
    await api.delete(`/characters/${characterId}/images/${imageId}`)
    await fetchCharacters(characters.value.find(c => c.id === characterId)?.projectId || '')
  }

  async function moveImage(characterId: string, imageId: string, parentId?: string) {
    const res = await api.put<CharacterImage>(`/characters/${characterId}/images/${imageId}/move`, { parentId })
    await fetchCharacters(characters.value.find(c => c.id === characterId)?.projectId || '')
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
    addImage,
    updateImage,
    deleteImage,
    moveImage
  }
})
