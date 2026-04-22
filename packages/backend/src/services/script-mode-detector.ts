/**
 * Intelligent script-mode detector.
 *
 * Decides how to process a script based on its completeness:
 * - faithful-parse: parse a complete script without changes
 * - expand: expand outlines / fragments
 * - ai-create: generate from scratch
 * - mixed: a combination of the above
 */

/** Processing mode for a single episode. */
export type EpisodeProcessingMode = 'faithful-parse' | 'expand' | 'ai-create'

/** Result of completeness detection for one episode. */
export interface EpisodeCompleteness {
  episodeNum: number
  mode: EpisodeProcessingMode
  confidence: number
  content?: string
}

import { logInfo } from '../lib/error-logger.js'

// ── Scoring constants ──

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

// ── RegExp constants ──

const RE_EPISODE_SPLIT = /第\s*(\d+)\s*集[\s\S]*?(?=第\s*\d+\s*集|$)/g
const RE_EPISODE_MARKER = /第\s*\d+\s*集/gi
const RE_SCENE_MARKER = /第?\d+[场景场]|scene\s*\d*/i
const RE_DIALOGUE_FORMAT = /["""「"]|[\u4e00-\u9fa5]+[：:]\s*[""「"]/
const RE_CHARACTER_DESC = /角色[：:]|人物[：:]|character/i

// ── Public API ──

/**
 * Detect the best processing mode for a script.
 *
 * @param script Full script text.
 * @returns Detection result with mode and optional per-episode breakdown.
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
      logInfo('ScriptModeDetector', '全剧本得分达到阈值但无法分集，降级为 AI 创作', {
        overallScore
      })
      return { mode: 'ai-create' }
    }

    const hasMixedMode = episodesMode.some((episode) => episode.mode !== 'faithful-parse')

    if (hasMixedMode) {
      const faithfulCount = episodesMode.filter(
        (episode) => episode.mode === 'faithful-parse'
      ).length
      const expandCount = episodesMode.filter((episode) => episode.mode === 'expand').length
      const createCount = episodesMode.filter((episode) => episode.mode === 'ai-create').length

      logInfo('ScriptModeDetector', '检测到混合模式', {
        faithfulCount,
        expandCount,
        createCount
      })
      return { mode: 'mixed', episodes: episodesMode }
    }

    logInfo('ScriptModeDetector', '检测到完整剧本，使用忠实解析模式', {
      episodeCount: episodesMode.length
    })
    return { mode: 'faithful-parse', episodes: episodesMode }
  }

  logInfo('ScriptModeDetector', '检测到创意想法，使用 AI 创作模式', {
    overallScore
  })
  return { mode: 'ai-create' }
}

/**
 * Quick overall-score heuristic for the whole script.
 *
 * @param script Full script text.
 * @returns Score between 0 and 10.
 */
export function calculateOverallScore(script: string): number {
  let score = 0

  // Indicator 1: episode markers – 3 pts (strongest signal)
  const episodeMatches = script.match(RE_EPISODE_MARKER) ?? []
  if (episodeMatches.length >= 3) score += SCORE_EPISODE_MATCHES_3PLUS
  else if (episodeMatches.length >= 1) score += SCORE_EPISODE_MATCHES_1PLUS

  // Indicator 2: scene markers – 2 pts
  if (RE_SCENE_MARKER.test(script)) score += SCORE_SCENE_MARKER

  // Indicator 3: dialogue format – 2 pts
  if (RE_DIALOGUE_FORMAT.test(script)) score += SCORE_DIALOGUE_FORMAT

  // Indicator 4: word count – 1 pt
  if (script.length > 5000) score += SCORE_WORD_COUNT_5K

  // Indicator 5: character descriptions – 2 pts
  if (RE_CHARACTER_DESC.test(script)) score += SCORE_CHARACTER_DESC

  return score
}

/**
 * Fine-grained per-episode detection.
 *
 * @param script Full script text.
 * @returns Array of per-episode processing modes.
 */
export function detectEpisodesMode(script: string): EpisodeCompleteness[] {
  const episodes = splitScriptByEpisodes(script)

  if (episodes.length === 0) {
    return []
  }

  return episodes.map((episode) => {
    const score = calculateCompletenessScore(episode.content)

    if (score >= COMPLETENESS_THRESHOLD_HIGH) {
      return {
        episodeNum: episode.number,
        mode: 'faithful-parse' as const,
        confidence: CONFIDENCE_FAITHFUL,
        content: episode.content
      }
    }

    if (score >= COMPLETENESS_THRESHOLD_LOW) {
      return {
        episodeNum: episode.number,
        mode: 'expand' as const,
        confidence: CONFIDENCE_EXPAND,
        content: episode.content
      }
    }

    return {
      episodeNum: episode.number,
      mode: 'ai-create' as const,
      confidence: CONFIDENCE_AI_CREATE,
      content: undefined
    }
  })
}

// ── Internal helpers ──

/**
 * Calculate completeness score for a single episode's text.
 *
 * @param content Episode text content.
 * @returns Score between 0 and 8.
 */
function calculateCompletenessScore(content: string): number {
  let score = 0

  // Indicator 1: scene markers (第X场 / scene X) – 2 pts
  if (RE_SCENE_MARKER.test(content)) score += SCORE_SCENE_MARKER

  // Indicator 2: dialogue format (quotes or character + colon) – 2 pts
  if (RE_DIALOGUE_FORMAT.test(content)) score += SCORE_DIALOGUE_FORMAT

  // Indicator 3: character descriptions – 1 pt
  if (RE_CHARACTER_DESC.test(content)) score += 1

  // Indicator 4: word count – up to 2 pts
  if (content.length > 1000) score += SCORE_WORD_COUNT_1K
  if (content.length > 3000) score += SCORE_WORD_COUNT_3K

  return score
}

/**
 * Split a full script into per-episode chunks.
 *
 * @param script Full script text.
 * @returns Array of episode chunks with episode number and content.
 */
function splitScriptByEpisodes(script: string): Array<{ number: number; content: string }> {
  const episodes: Array<{ number: number; content: string }> = []

  const regex = new RegExp(RE_EPISODE_SPLIT.source, RE_EPISODE_SPLIT.flags)
  let match: RegExpExecArray | null

  while ((match = regex.exec(script)) !== null) {
    episodes.push({
      number: parseInt(match[1], 10),
      content: match[0].trim()
    })
  }

  return episodes
}
