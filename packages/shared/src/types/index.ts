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
  synopsis?: string
  /** 项目画幅（如 9:16）；未设置时应用层按 9:16 处理 */
  aspectRatio?: string | null
  visualStyle?: string[]
  storyContext?: string | null
  episodes?: Episode[]
  /** 列表接口可能只带一条，用于判断「是否已解析出角色」 */
  characters?: Array<{ id: string }>
  /** Prisma `Location` 表：项目下的场地库（勿与 DOM `Location`、剧本里的场景地点字符串混淆） */
  locations?: ProjectLocation[]
  createdAt: Date
  updatedAt: Date
}

/** 项目场地库一行（对应 Prisma `Location`，字段 `name` 映射库列 `location`） */
export interface ProjectLocation {
  id: string
  projectId: string
  name: string
  timeOfDay?: string | null
  characters: string[]
  description?: string | null
  imagePrompt?: string | null
  imageUrl?: string | null
  /** 定场图最近一次成功生成的估算成本（元），来自方舟 usage 换算 */
  imageCost?: number | null
  /** 软删除时间；列表接口不返回已删除行 */
  deletedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

// ============ Script / Episode Types ============

/** GET /episodes 列表聚合：剧本场/角色与入库场次/出镜角色，供分集卡片展示 */
export interface EpisodeListStats {
  /** 剧本 JSON 中的场数 */
  scriptSceneCount: number
  /** 剧本各场 `characters` 名字去重数量 */
  scriptCharacterCount: number
  /** 已入库场次（Scene 行数），含导入剧本与 AI 分镜脚本写入 */
  storyboardSceneCount: number
  /** 本集场次中出场角色去重（台词 SceneDialogue + 分镜 CharacterShot） */
  storyboardCharacterCount: number
  /** 是否已有入库场次（有则优先展示分镜场数） */
  hasStoryboardScenes: boolean
  /** 是否已有成功完成的「AI 生成分镜脚本」任务（每集仅允许成功一次） */
  storyboardScriptJobCompleted: boolean
}

export interface Episode {
  id: string
  projectId: string
  episodeNum: number
  title?: string
  synopsis?: string | null
  /** 完整剧本 JSON（与 Prisma `Episode.script` 一致） */
  script?: ScriptContent
  createdAt: Date
  updatedAt: Date
  /** 仅列表接口附带，见 EpisodeListStats */
  listStats?: EpisodeListStats
}

export interface ScriptContent {
  title: string
  summary: string // 梗概
  metadata?: ScriptMetadata  // 剧本元数据
  scenes: ScriptScene[]
  /** 分镜脚本富文本（TipTap JSON 等），可选，与 scenes 并存 */
  editorDoc?: Record<string, unknown> | null
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

/** 分镜脚本中每镜出场角色（关联 CharacterImage.name） */
export interface ScriptStoryboardShotCharacter {
  characterName: string
  imageName: string
  action?: string
}

/** 分镜脚本中的镜头行（AI 生成分镜剧本时可多镜） */
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
  location: string // 场景地点
  timeOfDay: string // 日/夜
  characters: string[] // 出现的角色名列表
  description: string // 场景描述
  dialogues: ScriptDialogueLine[]
  actions: string[] // 动作描述列表
  /** 若存在且非空，则按多镜写入 Shot + CharacterShot；否则沿用单场首镜 */
  shots?: ScriptStoryboardShot[]
}

/** 剧本 JSON 中的单行台词（非 DB SceneDialogue） */
export interface ScriptDialogueLine {
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
  prompt?: string | null
  avatarUrl?: string
  /** 方舟文生图 / 图生图最近一次成功生成的估算成本（元） */
  imageCost?: number | null
  parentId?: string  // 父节点，null 为基础形象
  type: string       // base/outfit/expression/pose
  description?: string
  order: number
  createdAt: Date
  updatedAt: Date
}

// ============ Episode Scene（场次，视频生成单元）/ Take ============

export interface EpisodeScene {
  id: string
  episodeId: string
  sceneNum: number
  description?: string
  status: SceneStatus
  createdAt: Date
  updatedAt: Date
}

export type SceneStatus = 'pending' | 'generating' | 'processing' | 'completed' | 'failed'

export interface Take {
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

// ============ Composition / Video Editing Types ============

export interface Composition {
  id: string
  projectId: string
  episodeId: string
  title: string
  status: CompositionStatus
  outputUrl?: string
  createdAt: Date
  updatedAt: Date
}

export type CompositionStatus = 'draft' | 'processing' | 'completed' | 'failed'

/** MVP：成片时间轴一项（场次 + 选用 Take） */
export interface CompositionTimelineClip {
  id?: string
  compositionId?: string
  sceneId: string
  takeId: string
  order: number
}

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
  episodeId: string
  title: string
}

export interface UpdateTimelineRequest {
  clips: Omit<CompositionTimelineClip, 'id' | 'compositionId'>[]
}

// ============ Worker Types ============

export interface VideoJobData {
  sceneId: string
  taskId: string
  prompt: string
  model: VideoModel
  referenceImage?: string
  imageUrls?: string[]
  duration?: number
  /** Seedance 2.0 宽高比（与 Scene / Project 一致时由服务端自动填充） */
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive'
}

/** BullMQ 图片生成任务（Worker 消费，HTTP 仅入队） */
export interface ImageGenerationJobBase {
  userId: string
  projectId: string
}

export type ImageGenerationJobData =
  | (ImageGenerationJobBase & {
      kind: 'character_base_create'
      characterId: string
      name: string
      prompt: string
    })
  | (ImageGenerationJobBase & {
      kind: 'character_base_regenerate'
      characterImageId: string
      prompt: string
    })
  | (ImageGenerationJobBase & {
      kind: 'character_derived_regenerate'
      characterImageId: string
      referenceImageUrl: string
      editPrompt: string
      strength?: number
    })
  | (ImageGenerationJobBase & {
      kind: 'character_derived_create'
      characterId: string
      parentImageId: string
      name: string
      type?: string
      description: string
      referenceImageUrl: string
      editPrompt: string
      strength?: number
    })
  | (ImageGenerationJobBase & {
      kind: 'location_establishing'
      locationId: string
      prompt: string
    })

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
  voiceSegments?: VoiceSegment[]  // 语音片段列表
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
  audioConfig?: SeedanceAudioPayload    // TTS 音频配置
}

/**
 * Seedance 音频片段
 */
export interface SeedanceAudioSegment {
  character_tag: string      // @Character1
  text: string
  voice_config: VoiceConfig
  start_time: number        // 秒
  duration: number          // 秒
}

/**
 * Seedance 音频载荷
 */
export interface SeedanceAudioPayload {
  type: 'tts'
  segments: SeedanceAudioSegment[]
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
 * 音色配置
 */
export interface VoiceConfig {
  gender: 'male' | 'female'
  age: 'young' | 'middle_aged' | 'old' | 'teen'
  tone: 'high' | 'mid' | 'low' | 'low_mid'
  timbre: 'warm_solid' | 'warm_thick' | 'clear_bright' | 'soft_gentle'
  speed: 'slow' | 'medium' | 'fast'
  pitch?: number      // 可选，音高偏移
  volume?: number     // 可选，音量
}

/**
 * 语音片段
 */
export interface VoiceSegment {
  id?: string
  characterId: string
  order: number
  startTimeMs: number
  durationMs: number
  text: string
  voiceConfig: VoiceConfig
  emotion?: string
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
