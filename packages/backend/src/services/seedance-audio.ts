/**
 * Seedance 2.0 音频参数对接
 * 从数据库读取 VoiceSegment，组装成 Seedance 音频参数
 */

import { prisma } from '../index.js'
import type {
  VoiceSegment as VoiceSegmentType,
  Character,
  VoiceConfig,
  SeedanceAudioSegment,
  SeedanceAudioPayload
} from '@dreamer/shared/types'

/**
 * 从数据库读取 VoiceSegment，组装成 Seedance 音频参数
 */
export async function buildSeedanceAudio(
  segmentId: string
): Promise<SeedanceAudioPayload> {
  const voiceSegments = await prisma.voiceSegment.findMany({
    where: { segmentId },
    orderBy: { order: 'asc' },
    include: {
      character: true
    }
  })

  const audioSegments: SeedanceAudioSegment[] = voiceSegments.map((vs, idx) => ({
    character_tag: `@Character${idx + 1}`,
    text: vs.text,
    voice_config: vs.voiceConfig as VoiceConfig,
    start_time: vs.startTimeMs / 1000,
    duration: vs.durationMs / 1000
  }))

  return { type: 'tts', segments: audioSegments }
}

/**
 * 获取分镜关联的所有语音片段（带角色信息）
 */
export async function getSegmentVoiceSegments(
  segmentId: string
): Promise<Array<VoiceSegmentType & { character: Character }>> {
  const results = await prisma.voiceSegment.findMany({
    where: { segmentId },
    orderBy: { order: 'asc' },
    include: { character: true }
  })

  return results.map(r => ({
    id: r.id,
    characterId: r.characterId,
    order: r.order,
    startTimeMs: r.startTimeMs,
    durationMs: r.durationMs,
    text: r.text,
    voiceConfig: r.voiceConfig as VoiceConfig,
    emotion: r.emotion || undefined,
    character: r.character as Character
  }))
}
