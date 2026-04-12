import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 120000,
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

/** 这些请求的 401 不触发全局跳转（例如密码错误） */
function isAuthPublicApiRequest(config: { url?: string; baseURL?: string } | undefined): boolean {
  if (!config) return false
  const path = `${config.baseURL || ''}${config.url || ''}`.replace(/\/{2,}/g, '/')
  return path.includes('/auth/login') || path.includes('/auth/register')
}

let authRedirectScheduled = false

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (isAuthPublicApiRequest(error.config)) {
        return Promise.reject(error)
      }
      const path = window.location.pathname
      if (path === '/login' || path === '/register') {
        return Promise.reject(error)
      }
      if (!authRedirectScheduled) {
        authRedirectScheduled = true
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        const next = encodeURIComponent(path + (window.location.search || ''))
        window.location.href = `/login?redirect=${next}`
      }
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

// Preview import without saving
export interface ImportPreview {
  projectName?: string
  description?: string
  characters: string[]
  episodes: Array<{
    episodeNum: number
    title: string
    sceneCount: number
    scenes: Array<{
      sceneNum: number
      description: string
    }>
  }>
}

export interface PreviewResult {
  success: boolean
  preview: ImportPreview
  aiCost: number
}

export async function previewImport(content: string, type: 'markdown' | 'json' = 'markdown') {
  const res = await api.post<PreviewResult>('/import/preview', { content, type })
  return res.data
}

// Stats API
export interface ProjectCostStats {
  projectId: string
  projectName: string
  totalCost: number
  aiCost: number
  videoCost: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  tasksByModel: {
    wan2dot6: { count: number; cost: number }
    seedance2dot0: { count: number; cost: number }
  }
  recentTasks: Array<{
    id: string
    model: string
    cost: number
    status: string
    createdAt: Date
  }>
}

export interface UserCostStats {
  userId: string
  totalCost: number
  aiCost: number
  videoCost: number
  totalProjects: number
  totalTasks: number
  projects: ProjectCostStats[]
}

export interface DailyCost {
  date: string
  wanCost: number
  seedanceCost: number
  total: number
}

export async function getUserStats() {
  const res = await api.get<UserCostStats>('/stats/me')
  return res.data
}

export async function getProjectStats(projectId: string) {
  const res = await api.get<ProjectCostStats>(`/stats/projects/${projectId}`)
  return res.data
}

export async function getCostTrend(projectId?: string, days?: number) {
  const params = new URLSearchParams()
  if (projectId) params.append('projectId', projectId)
  if (days) params.append('days', days.toString())
  const res = await api.get<DailyCost[]>(`/stats/trend?${params}`)
  return res.data
}

export interface AiBalance {
  isAvailable: boolean
  balanceInfos: Array<{
    currency: string
    totalBalance: number
    grantedBalance: number
    toppedUpBalance: number
  }>
}

export async function getAiBalance() {
  const res = await api.get<AiBalance>('/stats/ai-balance')
  return res.data
}

// Pipeline API
export interface PipelineStepInfo {
  id: string
  description: string
}

export interface PipelineExecuteParams {
  projectId: string
  idea: string
  targetEpisodes?: number
  targetDuration?: number
  defaultAspectRatio?: '16:9' | '9:16' | '1:1'
  defaultResolution?: '480p' | '720p'
}

// Pipeline Job 类型
export interface PipelineJob {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  jobType?: string
  currentStep: string
  progress: number
  progressMeta?: { current?: number; total?: number; message?: string } | null
  error?: string
  stepResults?: PipelineStepResult[]
  createdAt: string
  updatedAt: string
}

export interface PipelineStepResult {
  step: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input?: any
  output?: any
  error?: string
}

// 创建 Pipeline Job
export interface PipelineExecuteResult {
  success: boolean
  data?: {
    jobId: string
    status: string
    message: string
  }
  error?: string
}

export async function executePipeline(params: PipelineExecuteParams) {
  const res = await api.post<PipelineExecuteResult>('/pipeline/execute', params)
  return res.data
}

// 获取 Job 状态
export async function getPipelineJob(jobId: string) {
  const res = await api.get<{ success: boolean; data?: PipelineJob }>(`/pipeline/job/${jobId}`)
  return res.data
}

/** 按 jobId 轮询直到 completed / failed */
export async function pollPipelineJob(
  jobId: string,
  onProgress?: (job: PipelineJob) => void,
  timeout = 600000,
  intervalMs = 2000
): Promise<PipelineJob> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = await getPipelineJob(jobId)
    const data = result.data
    if (!data) throw new Error('无法获取任务状态')
    onProgress?.(data)
    if (data.status === 'completed') return data
    if (data.status === 'failed') throw new Error(data.error || '任务失败')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('任务超时')
}

// 获取项目的 Pipeline 状态
export async function getPipelineStatus(projectId: string) {
  const res = await api.get<{
    success: boolean
    data?: {
      id?: string
      status: string
      currentStep?: string
      progress?: number
      error?: string
      stepResults?: PipelineStepResult[]
    }
  }>(`/pipeline/status/${projectId}`)
  return res.data
}

// 获取 Pipeline 步骤列表
export async function getPipelineSteps() {
  const res = await api.get<{ steps: PipelineStepInfo[] }>('/pipeline/steps')
  return res.data
}

// 轮询 Pipeline 状态
export async function pollPipelineStatus(
  projectId: string,
  onProgress?: (job: PipelineJob) => void,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<PipelineJob> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getPipelineJobStatus(projectId)
    if (result.data) {
      const job = result.data as unknown as PipelineJob
      onProgress?.(job)

      if (job.status === 'completed' || job.status === 'failed') {
        return job
      }
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error('Pipeline polling timeout')
}

// 获取 Job 详情（内部使用）
async function getPipelineJobStatus(jobId: string): Promise<{ data?: PipelineJob }> {
  const res = await api.get<{ success: boolean; data?: PipelineJob }>(`/pipeline/job/${jobId}`)
  return res.data
}

export { api }
