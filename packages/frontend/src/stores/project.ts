import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '@shared/types'
import { api } from '@/api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)

  async function fetchProjects() {
    const res = await api.get<Project[]>('/projects')
    projects.value = res.data
  }

  async function getProject(id: string) {
    const res = await api.get<Project>(`/projects/${id}`)
    currentProject.value = res.data
    return res.data
  }

  async function createProject(data: { name: string; description?: string }) {
    const res = await api.post<Project>('/projects', data)
    projects.value.unshift(res.data)
    return res.data
  }

  async function updateProject(id: string, data: Partial<Project>) {
    const res = await api.put<Project>(`/projects/${id}`, data)
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = res.data
    }
    return res.data
  }

  async function deleteProject(id: string) {
    await api.delete(`/projects/${id}`)
    projects.value = projects.value.filter(p => p.id !== id)
  }

  return {
    projects,
    currentProject,
    fetchProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject
  }
})
