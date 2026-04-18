/**
 * 从数据库读取 SceneDialogue，组装成 Seedance 音频参数
 */

import { sceneRepository } from '../../repositories/scene-repository.js'
import type {
  VoiceSegment as VoiceSegmentType,
  Character,
  VoiceConfig,
  SeedanceAudioSegment,
  SeedanceAudioPayload
} from '@dreamer/shared/types'

export async function buildSeedanceAudio(sceneId: string): Promise<SeedanceAudioPayload> {
  const rows = await sceneRepository.findDialoguesBySceneWithCharacter(sceneId)

  const audioSegments: SeedanceAudioSegment[] = rows.map((vs, idx) => ({
    character_tag: `@Character${idx + 1}`,
    text: vs.text,
    voice_config: vs.voiceConfig as unknown as VoiceConfig,
    start_time: vs.startTimeMs / 1000,
    duration: vs.durationMs / 1000
  }))

  return { type: 'tts', segments: audioSegments }
}

export async function getSceneVoiceSegments(
  sceneId: string
): Promise<Array<VoiceSegmentType & { character: Character }>> {
  const results = await sceneRepository.findDialoguesBySceneWithCharacter(sceneId)

  return results.map((r) => ({
    id: r.id,
    characterId: r.characterId,
    order: r.order,
    startTimeMs: r.startTimeMs,
    durationMs: r.durationMs,
    text: r.text,
    voiceConfig: r.voiceConfig as unknown as VoiceConfig,
    emotion: r.emotion || undefined,
    character: r.character as Character
  }))
}
