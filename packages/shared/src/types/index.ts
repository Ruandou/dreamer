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
  metadata?: ScriptMetadata  // 剧本元数据
  scenes: ScriptScene[]
}

export interface ScriptMetadata {
  genre?: string        // 古装/现代/科幻
  style?: string        // 穿越/逆袭/甜宠
  tone?: string         // 幽默/严肃/悬疑
  targetAudience?: string // 18-25女性/25-35女性/通用
  coreConflict?: string  // 核心冲突
  keyPlotPoints?: string[]  // 关键情节点
  totalEstimatedDuration?: number  // 总时长预估（秒）
  recommendedEpisodes?: number    // 推荐集数
  characters?: string[]            // 角色列表
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
  segmentId: string
  taskId: string
  prompt: string
  model: VideoModel
  referenceImage?: string  // 单张参考图 (Wan 2.6)
  imageUrls?: string[]  // 多张参考图 (Seedance 2.0)
  duration?: number
}

// ============ Pipeline Types ============

/**
 * 分集计划
 */
export interface EpisodePlan {
  episodeNum: number
  title: string
  synopsis: string           // 本集梗概
  sceneCount: number         // 场景数
  estimatedDuration: number  // 预估时长（秒）
  keyMoments: string[]      // 关键画面
  sceneIndices?: number[]   // 对应原始剧本的场景索引
}

/**
 * 角色动作
 */
export interface CharacterAction {
  characterName: string
  actionType: 'movement' | 'expression' | 'dialogue' | 'reaction'
  description: string        // 动作描述
  emotion?: string          // 情绪
  intensity?: 'low' | 'medium' | 'high'
  suggestedReferenceImageTypes?: string[]  // 建议参考图类型
}

/**
 * 场景动作分析
 */
export interface SceneActions {
  sceneNum: number
  actions: CharacterAction[]
  suggestedDuration: number   // 建议时长 4-15秒
  videoStyle: 'action' | 'dialogue' | 'landscape' | 'mixed'
  suggestedCameraMovement?: string  // 建议镜头运动
  suggestedAspectRatio?: '16:9' | '9:16' | '1:1'
}

/**
 * 场景素材
 */
export interface SceneAsset {
  id?: string
  type: 'background' | 'atmosphere' | 'style' | 'prop' | 'location' | 'character'
  url?: string
  description: string
  applicableLocations?: string[]
  applicableGenres?: string[]
  mood?: string[]
}

/**
 * 场景素材推荐
 */
export interface SceneAssetRecommendation {
  sceneNum: number
  recommendedAssets: Array<{
    asset: SceneAsset
    relevance: number      // 相关度 0-1
    usage: 'background' | 'reference' | 'style' | 'atmosphere'
  }>
  compositePrompt?: string  // 组合后的素材提示词
}

/**
 * 分镜片段
 */
export interface StoryboardSegment {
  id?: string
  episodeNum: number
  segmentNum: number         // 片段编号
  description: string       // 分镜描述（给AI看）
  duration: number         // 4-15秒
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'
  characters: Array<{
    name: string
    actions: CharacterAction[]
    referenceImageUrl?: string
  }>
  location: string
  timeOfDay: string
  visualStyle: string[]       // 视觉风格描述
  cameraMovement: string    // 镜头运动
  specialEffects: string[]  // 特效建议
  seedancePrompt: string    // 最终给Seedance的提示词
  contextForNext?: string   // 给下一步AI的操作提示
  sceneAssets: SceneAsset[] // 关联的素材
  compositeImageUrls: string[]  // 最终传给Seedance的参考图（最多9张）
  subShots?: SubShot[]     // 子片段列表
  characterActions?: Record<string, string>  // characterName -> action
}

/**
 * 子片段
 */
export interface SubShot {
  id?: string
  order: number
  durationMs: number
  description: string
}

/**
 * Seedance 片段配置
 */
export interface SeedanceSegmentConfig {
  prompt: string
  imageUrls: string[]                    // 最多9张参考图
  duration: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'
  resolution: '480p' | '720p'
  generateAudio: boolean
}

/**
 * 流水线步骤
 */
export type PipelineStep =
  | 'script-writing'       // 阶段1
  | 'episode-splitting'   // 阶段2
  | 'action-extraction'   // 阶段3
  | 'asset-matching'     // 阶段3.5
  | 'storyboard-generation' // 阶段4
  | 'seedance-parametrization' // 阶段5
  | 'video-generation'     // 阶段6

/**
 * 流水线状态
 */
export interface PipelineStatus {
  projectId: string
  currentStep: PipelineStep
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number  // 0-100
  results?: Record<PipelineStep, any>
  error?: string
}

/**
 * 流水线结果
 */
export interface PipelineResult {
  script?: ScriptContent
  episodes?: EpisodePlan[]
  sceneActions?: SceneActions[]
  assetRecommendations?: SceneAssetRecommendation[]
  storyboard?: StoryboardSegment[]
  seedanceConfigs?: SeedanceSegmentConfig[]
}
