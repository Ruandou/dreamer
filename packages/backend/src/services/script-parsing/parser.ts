/**
 * Script content parser — pure functions for parsing LLM responses into ScriptContent
 */

import type { ScriptContent, ScriptScene, ScriptDialogueLine } from '@dreamer/shared/types'
import { logWarning, logError, logInfo } from '../../lib/error-logger.js'

/**
 * Parse a raw LLM response string into ScriptContent.
 * Handles markdown code blocks, quote wrapping, and JSON extraction.
 */
export function parseScriptResponse(
  content: string,
  options?: {
    cleanMarkdownCodeBlocks?: (content: string) => string
  }
): ScriptContent {
  // Use provided cleaner or minimal fallback
  const cleanContent = options?.cleanMarkdownCodeBlocks
    ? options.cleanMarkdownCodeBlocks(content)
    : content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim()

  // Remove possible quote wrapping
  const unquoted =
    cleanContent.startsWith('"') && cleanContent.endsWith('"')
      ? cleanContent.slice(1, -1)
      : cleanContent

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(unquoted)
    return convertToScriptContent(parsed)
  } catch (error) {
    logWarning('ScriptParsing', 'Direct JSON parse failed, attempting extraction...')

    // Try extracting JSON block
    const jsonMatch = unquoted.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        logInfo('ScriptParsing', 'Extracted JSON block, parsing...')
        return convertToScriptContent(JSON.parse(jsonMatch[0]))
      } catch (innerError) {
        logError('ScriptParsing', 'JSON extract failed', {
          rawContentPreview: unquoted.substring(0, 1000),
          extractedJsonPreview: jsonMatch[0].substring(0, 1000),
          errorMessage: innerError instanceof Error ? innerError.message : String(innerError)
        })
        throw new Error(
          `剧本JSON格式不正确: ${innerError instanceof Error ? innerError.message : '未知错误'}`,
          { cause: innerError }
        )
      }
    }

    logError('ScriptParsing', 'No JSON found in response', {
      contentPreview: unquoted.substring(0, 500)
    })
    throw new Error('剧本格式不正确，无法解析', { cause: error })
  }
}

/**
 * Convert loosely-typed parsed data into a strongly-typed ScriptContent.
 * Handles multiple input shapes (scenes/segments/episodes nesting).
 */
export function convertToScriptContent(data: unknown): ScriptContent {
  const d = data as Record<string, unknown>
  let scenesArray: Record<string, unknown>[] = []

  // Support scenes or segments (segment is the newer naming)
  if (Array.isArray(d.scenes)) {
    scenesArray = d.scenes as Record<string, unknown>[]
  } else if (Array.isArray(d.segments)) {
    scenesArray = d.segments as Record<string, unknown>[]
  } else if (Array.isArray(d.episodes) && d.episodes.length > 0) {
    // Compatible with nested episodes structure
    const firstEp = (d.episodes as Record<string, unknown>[])[0]
    scenesArray =
      (firstEp?.scenes as Record<string, unknown>[]) ||
      (firstEp?.segments as Record<string, unknown>[]) ||
      []
  }

  const scenes: ScriptScene[] = scenesArray.map((s, index: number) => {
    // Process dialogues
    let dialogues: ScriptDialogueLine[] = []
    if (Array.isArray(s.dialogues)) {
      dialogues = (s.dialogues as Record<string, unknown>[]).map((dialogue) => ({
        character: String(dialogue.character || dialogue.name || ''),
        content: String(dialogue.content || dialogue.line || '')
      }))
    } else if (s.dialogue && typeof s.dialogue === 'object') {
      dialogues = Object.entries(s.dialogue as Record<string, unknown>).map(
        ([character, content]) => ({
          character,
          content: content as string
        })
      )
    }

    // Process actions
    let actions: string[] = []
    if (Array.isArray(s.actions)) {
      actions = s.actions as string[]
    } else if (typeof s.action === 'string') {
      actions = (s.action as string).split(/(?<=[。！？；.!?;])/).filter(Boolean)
    }

    return {
      sceneNum: (s.segmentNum || s.sceneNum || s.scene_number || index + 1) as number,
      location: String(s.location || ''),
      timeOfDay: String(s.timeOfDay || s.time || '日'),
      characters: Array.isArray(s.characters) ? (s.characters as string[]) : [],
      description: String(s.description || ''),
      dialogues,
      actions
    }
  })

  return {
    title: String(d.title || d.episode_title || '未命名剧本'),
    summary: String(d.summary || ''),
    scenes
  }
}
