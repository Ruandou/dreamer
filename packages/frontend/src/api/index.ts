import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Helper for form data requests (file uploads)
;(api as any).postFormData = async <T>(url: string, formData: FormData): Promise<AxiosResponse<T>> => {
  return api.post<T>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// Import script document to existing project (async task)
export async function importScript(
  projectId: string,
  content: string,
  type: 'markdown' | 'json' = 'markdown'
) {
  const res = await api.post('/import/script', {
    projectId,
    content,
    type
  })
  return res.data
}

// Import and create new project from document (async task)
export async function importProject(
  content: string,
  type: 'markdown' | 'json' = 'markdown'
) {
  const res = await api.post('/import/project', {
    content,
    type
  })
  return res.data
}

// Get import task status
export async function getImportTaskStatus(taskId: string) {
  const res = await api.get(`/import/task/${taskId}`)
  return res.data
}

export { api }
