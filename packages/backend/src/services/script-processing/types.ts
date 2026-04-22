/**
 * 剧本处理相关类型定义
 */

/** 剧本模式检测结果 */
export interface ScriptModeDetection {
  mode: 'faithful-parse' | 'mixed' | 'ai-creation'
  episodes?: Array<{
    episodeNum: number
    content?: string
    title?: string
  }>
}

/** 首集生成选项 */
export interface FirstEpisodeOptions {
  projectId: string
  targetEpisodes?: number
}

/** 首集生成结果 */
export interface FirstEpisodeResult {
  episodeCount: number
  parsedCount: number
  failedCount: number
}

/** 批量剧集生成选项 */
export interface BatchEpisodeOptions {
  projectId: string
  startEpisode?: number
  targetEpisodes?: number
}

/** 批量剧集生成结果 */
export interface BatchEpisodeResult {
  generatedCount: number
  failedCount: number
  totalEpisodes: number
}

/** 剧本解析选项 */
export interface ScriptParseOptions {
  projectId: string
  userId: string
  episodes: Array<{
    episodeNum: number
    content: string
  }>
}

/** 剧本解析结果 */
export interface ScriptParseResult {
  parsedCount: number
  failedCount: number
}
