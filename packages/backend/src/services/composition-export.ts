/**
 * 成片导出：供 compositions 路由与按集 compose 复用
 */

import { compositionRepository } from '../repositories/composition-repository.js'
import { composeVideo, type CompositionClip } from './ffmpeg.js'

export type CompositionExportResult =
  | { ok: true; outputUrl: string; duration: number }
  | { ok: false; error: string; httpStatus: number }

export async function runCompositionExport(
  compositionId: string
): Promise<CompositionExportResult> {
  const composition = await compositionRepository.findUniqueForExport(compositionId)

  if (!composition) {
    return { ok: false, error: 'Composition not found', httpStatus: 404 }
  }

  if (composition.scenes.length === 0) {
    return { ok: false, error: 'No clips to export', httpStatus: 400 }
  }

  await compositionRepository.update(compositionId, { status: 'processing' })

  try {
    const clips: CompositionClip[] = []

    for (const row of composition.scenes) {
      const url = row.take.videoUrl
      if (!url) {
        throw new Error(`Take ${row.takeId} has no video URL`)
      }
      clips.push({
        videoUrl: url,
        startTime: 0,
        endTime: 0
      })
    }

    const result = await composeVideo({
      segments: clips
    })

    await compositionRepository.update(compositionId, {
      status: 'completed',
      outputUrl: result.outputUrl
    })

    return { ok: true, outputUrl: result.outputUrl, duration: result.duration }
  } catch (error) {
    console.error('Export failed:', error)

    await compositionRepository.update(compositionId, { status: 'failed' })

    const message = error instanceof Error ? error.message : 'Unknown error'
    return { ok: false, error: message, httpStatus: 500 }
  }
}
