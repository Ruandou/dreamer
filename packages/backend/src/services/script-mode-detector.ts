/**
 * 智能剧本模式检测
 * 根据剧本文本完整度，决定处理模式：
 * - faithful-parse：忠实解析完整剧本
 * - expand：扩展大纲/片段
 * - ai-create：AI 创作
 * - mixed：混合模式
 */

/** 单集处理模式 */
export type EpisodeProcessingMode = 'faithful-parse' | 'expand' | 'ai-create'

/** 单集完整度检测结果 */
export interface EpisodeCompleteness {
  episodeNum: number
  mode: EpisodeProcessingMode
  confidence: number
  content?: string
}

// ── 评分指标常量 ──

const SCORE_EPISODE_MATCHES_3PLUS = 3
const SCORE_EPISODE_MATCHES_1PLUS = 2
const SCORE_SCENE_MARKER = 2
const SCORE_DIALOGUE_FORMAT = 2
const SCORE_CHARACTER_DESC = 2
const SCORE_WORD_COUNT_1K = 1
const SCORE_WORD_COUNT_3K = 1
const SCORE_WORD_COUNT_5K = 1

const COMPLETENESS_THRESHOLD_HIGH = 6
const COMPLETENESS_THRESHOLD_LOW = 3

const OVERALL_THRESHOLD = 5
const CONFIDENCE_FAITHFUL = 0.95
const CONFIDENCE_EXPAND = 0.8
const CONFIDENCE_AI_CREATE = 0.7

// ── 正则常量 ──

const RE_EPISODE_SPLIT = /第\s*(\d+)\s*集[\s\S]*?(?=第\s*\d+\s*集|$)/g
const RE_EPISODE_MARKER = /第\s*\d+\s*集/gi
const RE_SCENE_MARKER = /第?\d+[场景场]|scene\s*\d*/i
const RE_DIALOGUE_FORMAT = /[""「"]|[\u4e00-\u9fa5]+[：:]\s*[""「"]/
const RE_CHARACTER_DESC = /角色[：:]|人物[：:]|character/i

// ── 公开 API ──

/**
 * 智能检测剧本处理模式
 * @param script 完整剧本文本
 * @returns 检测结果
 */
export function detectScriptMode(
  script: string
):
  | { mode: 'faithful-parse'; episodes?: EpisodeCompleteness[] }
  | { mode: 'expand'; episodes: EpisodeCompleteness[] }
  | { mode: 'mixed'; episodes: EpisodeCompleteness[] }
  | { mode: 'ai-create'; episodes?: never } {
  const overallScore = calculateOverallScore(script)

  if (overallScore >= OVERALL_THRESHOLD) {
    const episodesMode = detectEpisodesMode(script)

    if (episodesMode.length === 0) {
      console.log(`[detect] 全剧本得分 ${overallScore}/8，但无法分集，降级为 AI 创作`)
      return { mode: 'ai-create' }
    }

    const hasMixedMode = episodesMode.some((ep) => ep.mode !== 'faithful-parse')

    if (hasMixedMode) {
      const faithfulCount = episodesMode.filter((ep) => ep.mode === 'faithful-parse').length
      const expandCount = episodesMode.filter((ep) => ep.mode === 'expand').length
      const createCount = episodesMode.filter((ep) => ep.mode === 'ai-create').length

      console.log(
        `[detect] 检测到混合模式：${faithfulCount} 集忠实解析，${expandCount} 集扩展生成，${createCount} 集 AI 创作`
      )
      return { mode: 'mixed', episodes: episodesMode }
    } else {
      console.log(`[detect] 检测到完整剧本（${episodesMode.length} 集），使用忠实解析模式`)
      return { mode: 'faithful-parse', episodes: episodesMode }
    }
  } else {
    console.log(`[detect] 全剧本得分 ${overallScore}/8，检测到创意想法，使用 AI 创作模式`)
    return { mode: 'ai-create' }
  }
}

/**
 * 全剧本级别检测（快速判断）
 * @param script 完整剧本文本
 * @returns 分数 0-10
 */
export function calculateOverallScore(script: string): number {
  let score = 0

  // 指标 1：分集标记 - 3分（最重要指标）
  const episodeMatches = script.match(RE_EPISODE_MARKER) || []
  if (episodeMatches.length >= 3) score += SCORE_EPISODE_MATCHES_3PLUS
  else if (episodeMatches.length >= 1) score += SCORE_EPISODE_MATCHES_1PLUS

  // 指标 2：场景标记 - 2分
  if (RE_SCENE_MARKER.test(script)) score += SCORE_SCENE_MARKER

  // 指标 3：对话格式 - 2分
  if (RE_DIALOGUE_FORMAT.test(script)) score += SCORE_DIALOGUE_FORMAT

  // 指标 4：字数 - 1分
  if (script.length > 5000) score += SCORE_WORD_COUNT_5K

  // 指标 5：角色说明 - 2分
  if (RE_CHARACTER_DESC.test(script)) score += SCORE_CHARACTER_DESC

  return score
}

/**
 * 逐集检测（精细判断）
 * @param script 完整剧本文本
 * @returns 每集的处理模式
 */
export function detectEpisodesMode(script: string): EpisodeCompleteness[] {
  const episodes = splitScriptByEpisodes(script)

  if (episodes.length === 0) {
    return []
  }

  return episodes.map((ep) => {
    const score = calculateCompletenessScore(ep.content)

    if (score >= COMPLETENESS_THRESHOLD_HIGH) {
      return {
        episodeNum: ep.num,
        mode: 'faithful-parse' as const,
        confidence: CONFIDENCE_FAITHFUL,
        content: ep.content
      }
    } else if (score >= COMPLETENESS_THRESHOLD_LOW) {
      return {
        episodeNum: ep.num,
        mode: 'expand' as const,
        confidence: CONFIDENCE_EXPAND,
        content: ep.content
      }
    } else {
      return {
        episodeNum: ep.num,
        mode: 'ai-create' as const,
        confidence: CONFIDENCE_AI_CREATE,
        content: undefined
      }
    }
  })
}

// ── 内部工具函数 ──

/**
 * 计算文本完整度分数
 * @param content 文本内容
 * @returns 分数 0-8
 */
function calculateCompletenessScore(content: string): number {
  let score = 0

  // 指标 1：场景标记（第X场/scene X）- 2分
  if (RE_SCENE_MARKER.test(content)) score += SCORE_SCENE_MARKER

  // 指标 2：对话格式（引号或角色名+冒号）- 2分
  if (RE_DIALOGUE_FORMAT.test(content)) score += SCORE_DIALOGUE_FORMAT

  // 指标 3：角色说明 - 1分
  if (RE_CHARACTER_DESC.test(content)) score += 1

  // 指标 4：字数 - 最多 2分
  if (content.length > 1000) score += SCORE_WORD_COUNT_1K
  if (content.length > 3000) score += SCORE_WORD_COUNT_3K

  return score
}

/**
 * 按集分割剧本
 * @param script 完整剧本文本
 * @returns 分集数组
 */
function splitScriptByEpisodes(script: string): Array<{ num: number; content: string }> {
  const episodes: Array<{ num: number; content: string }> = []

  const regex = new RegExp(RE_EPISODE_SPLIT.source, RE_EPISODE_SPLIT.flags)
  let match

  while ((match = regex.exec(script)) !== null) {
    episodes.push({
      num: parseInt(match[1], 10),
      content: match[0].trim()
    })
  }

  return episodes
}
