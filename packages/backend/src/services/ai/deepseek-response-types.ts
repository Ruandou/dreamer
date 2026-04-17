/**
 * DeepSeek API 响应的类型定义
 * 用于替代 any 类型，提高类型安全性
 */

/** DeepSeek 返回的对话行格式 */
export interface DeepSeekDialogueLine {
  character?: string
  name?: string
  content?: string
  line?: string
}

/** DeepSeek 返回的分镜格式 */
export interface DeepSeekStoryboardShot {
  shotNum?: number
  order?: number
  description?: string
  cameraAngle?: string
  cameraMovement?: string
  duration?: number | string
  characters?: Array<{
    characterName?: string
    name?: string
    imageName?: string
    action?: string
  }>
}

/** DeepSeek 返回的场景格式 */
export interface DeepSeekScene {
  sceneNum?: number
  scene_number?: number
  location?: string
  timeOfDay?: string
  time?: string
  characters?: string[]
  description?: string
  dialogues?: DeepSeekDialogueLine[] | Record<string, string>
  dialogue?: Record<string, string>
  actions?: string[]
  action?: string
  shots?: DeepSeekStoryboardShot[]
}

/** DeepSeek 返回的剧本格式（标准） */
export interface DeepSeekScriptResponse {
  title?: string
  episode_title?: string
  summary?: string
  scenes?: DeepSeekScene[]
}

/** DeepSeek 返回的剧本格式（嵌套 episodes） */
export interface DeepSeekEpisodesResponse {
  title?: string
  episode_title?: string
  summary?: string
  episodes?: Array<{
    scenes?: DeepSeekScene[]
  }>
}

/** DeepSeek 可能返回的联合类型 */
export type DeepSeekScriptData = DeepSeekScriptResponse | DeepSeekEpisodesResponse

/** 类型守卫：判断是否为 episodes 格式 */
export function isEpisodesResponse(data: DeepSeekScriptData): data is DeepSeekEpisodesResponse {
  return 'episodes' in data && Array.isArray((data as DeepSeekEpisodesResponse).episodes)
}
