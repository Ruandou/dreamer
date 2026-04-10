// ============ Base Types ============

export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

// ============ Script / Episode Types ============

export interface Episode {
  id: string
  projectId: string
  episodeNum: number
  title?: string
  script?: ScriptContent // 结构化剧本JSON
  createdAt: Date
  updatedAt: Date
}

export interface ScriptContent {
  title: string
  summary: string // 梗概
  scenes: ScriptScene[]
}

export interface ScriptScene {
  sceneNum: number
  location: string // 场景地点
  timeOfDay: string // 日/夜
  characters: string[] // 出现的角色名列表
  description: string // 场景描述
  dialogues: Dialogue[]
  actions: string[] // 动作描述列表
}

export interface Dialogue {
  character: string
  content: string
}

// ============ Character Types ============

export interface Character {
  id: string
  projectId: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  images?: CharacterImage[] // 形象列表
}

export interface CharacterImage {
  id: string
  characterId: string
  name: string
  avatarUrl?: string
  parentId?: string  // 父节点，null 为基础形象
  type: string       // base/outfit/expression/pose
  description?: string
  order: number
  createdAt: Date
  updatedAt: Date
}

// ============ Scene / Storyboard Types ============

export interface Scene {
  id: string
  episodeId: string
  sceneNum: number
  description?: string // 场景描述
  prompt: string // 生成视频的最终提示词
  status: SceneStatus
  createdAt: Date
  updatedAt: Date
}

export type SceneStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface VideoTask {
  id: string
  sceneId: string
  model: VideoModel
  status: TaskStatus
  prompt: string
  cost?: number
  duration?: number // 生成耗时（秒）
  videoUrl?: string
  thumbnailUrl?: string
  errorMsg?: string
  isSelected: boolean
  createdAt: Date
  updatedAt: Date
}

export type VideoModel = 'wan2.6' | 'seedance2.0'
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed'

// ============ Composition / Video Editing Types ============

export interface Composition {
  id: string
  projectId: string
  title: string
  duration: number // 总时长（秒）
  width: number
  height: number
  status: CompositionStatus
  voiceover?: string // 配音文件URL
  bgm?: string // 背景音乐URL
  subtitles?: string // 字幕文件URL
  outputUrl?: string // 最终成品URL
  createdAt: Date
  updatedAt: Date
}

export type CompositionStatus = 'draft' | 'composing' | 'exporting' | 'exported'

export interface Segment {
  id: string
  compositionId: string
  sceneId: string
  order: number // 时间轴顺序
  startTime: number // 起始时间（秒）
  endTime: number // 结束时间（秒）
  transition?: TransitionType
}

export type TransitionType = 'none' | 'fade' | 'dissolve' | 'wipe' | 'slide'

// ============ API Request/Response Types ============

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Auth
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

// Project
export interface CreateProjectRequest {
  name: string
  description?: string
}

// Episode / Script
export interface CreateEpisodeRequest {
  projectId: string
  episodeNum: number
  title?: string
}

export interface ExpandScriptRequest {
  episodeId: string
  summary: string // 一句话梗概
}

// Character
export interface CreateCharacterRequest {
  projectId: string
  name: string
  description?: string
  avatarUrl?: string
}

// Scene / Storyboard
export interface CreateSceneRequest {
  episodeId: string
  sceneNum: number
  description?: string
  prompt: string
}

export interface GenerateVideoRequest {
  model: VideoModel
  referenceImage?: string // 角色参考图URL
  duration?: number // 期望时长（秒）
}

export interface BatchGenerateRequest {
  sceneIds: string[]
  model: VideoModel
  referenceImage?: string
}

// Composition
export interface CreateCompositionRequest {
  projectId: string
  title: string
}

export interface UpdateTimelineRequest {
  segments: Omit<Segment, 'id' | 'compositionId'>[]
}

// ============ Worker Types ============

export interface VideoJobData {
  sceneId: string
  taskId: string
  prompt: string
  model: VideoModel
  referenceImage?: string
  duration?: number
}
