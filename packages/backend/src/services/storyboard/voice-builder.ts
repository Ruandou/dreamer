/**
 * Voice segment builder for storyboard scenes
 */

import type {
  ScriptScene,
  SceneActions,
  VoiceSegment,
  StoryboardSegment
} from '@dreamer/shared/types'
import { inferVoiceConfig } from './voice-config-inferrer.js'

/**
 * Build voice segments from scene dialogues.
 */
export function buildVoiceSegments(
  scene: ScriptScene,
  characters: StoryboardSegment['characters'],
  sceneActions: SceneActions
): VoiceSegment[] {
  if (!scene.dialogues || scene.dialogues.length === 0) {
    return []
  }

  const voiceSegments: VoiceSegment[] = []
  let currentTimeMs = 0

  // Estimate duration per line based on text length
  const estimateDuration = (text: string): number => {
    // ~200 chars/min = ~3.3 chars/sec, plus pause time
    return Math.max(1000, text.length * 50 + 500)
  }

  // Get character emotion from actions
  const getEmotion = (characterName: string): string | undefined => {
    for (const action of sceneActions.actions) {
      if (action.characterName === characterName && action.emotion) {
        return action.emotion
      }
    }
    return undefined
  }

  // Get character ID (placeholder — should lookup from project characters)
  const getCharacterId = (_characterName: string): string => {
    return ''
  }

  for (let i = 0; i < scene.dialogues.length; i++) {
    const dialogue = scene.dialogues[i]
    const durationMs = estimateDuration(dialogue.content)

    const emotion = getEmotion(dialogue.character)
    const voiceConfig = inferVoiceConfig(dialogue.character, emotion, scene.timeOfDay)

    voiceSegments.push({
      characterId: getCharacterId(dialogue.character),
      order: i + 1,
      startTimeMs: currentTimeMs,
      durationMs,
      text: dialogue.content,
      voiceConfig,
      emotion
    })

    currentTimeMs += durationMs
  }

  return voiceSegments
}
