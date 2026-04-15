/**
 * 从 Scene + Shot + CharacterShot + Location + SceneDialogue 组装 Seedance 提示词与参考图 URL（方舟「图片1」序号与 image_url 顺序一致）
 */

import { stitchScenePrompt } from './scene-prompt.js'
import { sceneRepository } from '../repositories/scene-repository.js'

const MAX_REF_IMAGES = 9
const MIN_DUR = 4
const MAX_DUR = 15

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function voiceConfigToShortDesc(v: unknown): string {
  if (!v || typeof v !== 'object') return ''
  const o = v as Record<string, string>
  const parts = [o.age, o.gender, o.timbre].filter(Boolean)
  return parts.join('，')
}

function mergeVisualStyleLabels(scene: { visualStyle: string[] }, project?: { visualStyle: string[] } | null): string {
  const merged = [...(scene.visualStyle || []), ...(project?.visualStyle || [])]
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of merged) {
    const t = (x || '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.join('，')
}

export type SceneWithSeedanceContext = NonNullable<
  Awaited<ReturnType<typeof sceneRepository.findUniqueWithSeedanceContext>>
>

/**
 * @returns null 若 scene 不存在
 */
export function buildSeedancePayloadFromScene(scene: SceneWithSeedanceContext): {
  prompt: string
  imageUrls: string[]
  durationSeconds: number
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive'
} | null {
  const shots = scene.shots
  const stitched = stitchScenePrompt(
    shots.map((s) => ({
      shotNum: s.shotNum,
      order: s.order,
      description: s.description,
      cameraMovement: s.cameraMovement,
      cameraAngle: s.cameraAngle
    }))
  )

  const imageUrls: string[] = []
  if (scene.location?.imageUrl?.trim()) {
    imageUrls.push(scene.location.imageUrl.trim())
  }

  const seenChar = new Set<string>()
  const characterIdToPicNum = new Map<string, number>()

  for (const shot of shots) {
    for (const cs of shot.characterShots) {
      const cid = cs.characterImage.characterId
      if (seenChar.has(cid)) continue
      const url = cs.characterImage.avatarUrl?.trim()
      if (!url) continue
      seenChar.add(cid)
      if (imageUrls.length >= MAX_REF_IMAGES) break
      imageUrls.push(url)
      characterIdToPicNum.set(cid, imageUrls.length)
    }
    if (imageUrls.length >= MAX_REF_IMAGES) break
  }

  const urlsCapped = imageUrls.slice(0, MAX_REF_IMAGES)

  /** 角色名 -> 「图片n」 */
  const nameToLabel = new Map<string, string>()
  for (const shot of shots) {
    for (const cs of shot.characterShots) {
      const cid = cs.characterImage.characterId
      const n = characterIdToPicNum.get(cid)
      if (n === undefined) continue
      const name = cs.characterImage.character.name?.trim()
      if (name) nameToLabel.set(name, `图片${n}`)
    }
  }

  let body = stitched.trim() || scene.description.trim()
  const names = [...nameToLabel.keys()].sort((a, b) => b.length - a.length)
  for (const name of names) {
    const label = nameToLabel.get(name)
    if (!label) continue
    body = body.replace(new RegExp(escapeRegExp(name), 'g'), label)
  }

  const dialogueLines: string[] = []
  for (const d of scene.dialogues) {
    const n = characterIdToPicNum.get(d.characterId)
    const label = n !== undefined ? `图片${n}` : d.character.name
    const t0 = d.startTimeMs / 1000
    const t1 = (d.startTimeMs + d.durationMs) / 1000
    const voice = voiceConfigToShortDesc(d.voiceConfig)
    const voiceBit = voice ? `${label}用${voice}声说道` : `${label}说道`
    dialogueLines.push(`${t0}-${t1}秒：${voiceBit}：「${d.text}」`)
  }

  let prompt = body
  if (dialogueLines.length > 0) {
    prompt += '\n\n对话时间轴：\n' + dialogueLines.join('\n')
  }

  const styleText = mergeVisualStyleLabels(scene, scene.episode.project)
  if (styleText) {
    prompt += `\n\n${styleText}，8K超高清。`
  } else {
    prompt += '\n\n8K超高清。'
  }

  let durationSeconds = Math.round(scene.duration / 1000)
  if (!durationSeconds || durationSeconds < MIN_DUR) {
    durationSeconds = Math.max(
      MIN_DUR,
      Math.round(shots.reduce((s, x) => s + (x.duration || 0), 0) / 1000) || MIN_DUR
    )
  }
  durationSeconds = Math.min(MAX_DUR, Math.max(MIN_DUR, durationSeconds))

  const ar = scene.aspectRatio || scene.episode.project.aspectRatio || '9:16'
  const aspectRatio = (['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'] as const).includes(
    ar as '9:16'
  )
    ? (ar as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive')
    : '9:16'

  return { prompt, imageUrls: urlsCapped, durationSeconds, aspectRatio }
}

export async function buildSeedanceScenePayload(sceneId: string) {
  const scene = await sceneRepository.findUniqueWithSeedanceContext(sceneId)
  if (!scene) return null
  return buildSeedancePayloadFromScene(scene)
}
