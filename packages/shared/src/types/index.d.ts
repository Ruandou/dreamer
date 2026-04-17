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
export interface Episode {
  id: string
  projectId: string
  episodeNum: number
  title?: string
  script?: ScriptContent
  createdAt: Date
  updatedAt: Date
}
export interface ScriptContent {
  title: string
  summary: string
  scenes: ScriptScene[]
  editorDoc?: Record<string, unknown> | null
}
export interface ScriptStoryboardShotCharacter {
  characterName: string
  imageName: string
  action?: string
}
export interface ScriptStoryboardShot {
  shotNum?: number
  order?: number
  description: string
  cameraAngle?: string
  cameraMovement?: string
  duration?: number
  characters?: ScriptStoryboardShotCharacter[]
}
export interface ScriptScene {
  sceneNum: number
  location: string
  timeOfDay: string
  characters: string[]
  description: string
  dialogues: Dialogue[]
  actions: string[]
  shots?: ScriptStoryboardShot[]
}
export interface Dialogue {
  character: string
  content: string
}
export interface Character {
  id: string
  projectId: string
  name: string
  description?: string
  avatarUrl?: string
  versions?: CharacterVersion[]
  createdAt: Date
  updatedAt: Date
}
export interface CharacterVersion {
  id: string
  name: string
  avatarUrl: string
  description?: string
}
export interface Scene {
  id: string
  episodeId: string
  sceneNum: number
  description?: string
  prompt: string
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
  duration?: number
  videoUrl?: string
  thumbnailUrl?: string
  errorMsg?: string
  isSelected: boolean
  createdAt: Date
  updatedAt: Date
}
export type VideoModel = 'wan2.6' | 'seedance2.0'
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed'
export interface Composition {
  id: string
  projectId: string
  title: string
  duration: number
  width: number
  height: number
  status: CompositionStatus
  voiceover?: string
  bgm?: string
  subtitles?: string
  outputUrl?: string
  createdAt: Date
  updatedAt: Date
}
export type CompositionStatus = 'draft' | 'composing' | 'exporting' | 'exported'
export interface Segment {
  id: string
  compositionId: string
  sceneId: string
  order: number
  startTime: number
  endTime: number
  transition?: TransitionType
}
export type TransitionType = 'none' | 'fade' | 'dissolve' | 'wipe' | 'slide'
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
export interface CreateProjectRequest {
  name: string
  description?: string
}
export interface CreateEpisodeRequest {
  projectId: string
  episodeNum: number
  title?: string
}
export interface ExpandScriptRequest {
  episodeId: string
  summary: string
}
export interface CreateCharacterRequest {
  projectId: string
  name: string
  description?: string
  avatarUrl?: string
}
export interface CreateSceneRequest {
  episodeId: string
  sceneNum: number
  description?: string
  prompt: string
}
export interface GenerateVideoRequest {
  model: VideoModel
  referenceImage?: string
  duration?: number
}
export interface BatchGenerateRequest {
  sceneIds: string[]
  model: VideoModel
  referenceImage?: string
}
export interface CreateCompositionRequest {
  projectId: string
  title: string
}
export interface UpdateTimelineRequest {
  segments: Omit<Segment, 'id' | 'compositionId'>[]
}
export interface VideoJobData {
  sceneId: string
  taskId: string
  prompt: string
  model: VideoModel
  referenceImage?: string
  imageUrls?: string[]
  duration?: number
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive'
}
//# sourceMappingURL=index.d.ts.map
