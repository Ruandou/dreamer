import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'

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
api.postFormData = async <T>(url: string, formData: FormData): Promise<AxiosResponse<T>> => {
  return api.post<T>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export { api }
