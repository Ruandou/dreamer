/**
 * 解析剧本后：用 DeepSeek 补全角色多形象 prompt 与场地定场图 imagePrompt
 */

import { prisma } from '../index.js'
import type { ScriptContent } from '@dreamer/shared/types'
import { fetchScriptVisualEnrichmentJson } from './deepseek.js'
import type { ModelCallLogContext } from './api-logger.js'

interface ParsedLocation {
  name: string
  imagePrompt?: string
}

interface ParsedCharImage {
  name: string
  type?: string
  description?: string
  prompt?: string
}

interface ParsedCharacter {
  name: string
  images?: ParsedCharImage[]
}

/** 衍生 prompt：若模型未写「相对 base」句式，则补锚定并摘要基础定妆，便于与主参考图一致（中英句式均识别） */
function buildDerivativePrompt(baseAnchor: string | null | undefined, derivativePrompt: string): string {
  const d = derivativePrompt.trim()
  if (!d) return d
  if (/same\s+(person|identity|character|face)/i.test(d)) return d
  if (/base\s+reference/i.test(d)) return d
  if (/unchanged|consistent\s+with/i.test(d)) return d
  if (/同一人|与基础|保持一致|参考基础|与基础定妆|相同人物|同一人物/i.test(d)) return d
  const b = (baseAnchor || '').trim().replace(/\s+/g, ' ')
  if (b.length >= 12) {
    return `与基础定妆为同一人；保持与基础形象一致的特征（${b.slice(0, 220)}）；本套仅变化：${d}`
  }
  return `与基础定妆为同一人；保持面部结构与年龄感一致；${d}`
}

function isDerivedImageType(t: string): t is 'outfit' | 'expression' | 'pose' {
  return t === 'outfit' || t === 'expression' || t === 'pose'
}

function slotProcessOrder(type: string | undefined): number {
  const t = (type || 'base').toLowerCase()
  if (t === 'base') return 0
  return 1
}

function sortCharacterImageSlots(slots: ParsedCharImage[]): ParsedCharImage[] {
  return [...slots].sort((a, b) => slotProcessOrder(a.type) - slotProcessOrder(b.type))
}

interface VisualPayload {
  locations?: ParsedLocation[]
  characters?: ParsedCharacter[]
}

function extractJsonObject(text: string): string {
  const t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) return fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) return t.slice(start, end + 1)
  return t
}

export async function applyScriptVisualEnrichment(projectId: string, script: ScriptContent): Promise<void> {
  const projectRow = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true }
  })
  const visualLog: ModelCallLogContext | undefined = projectRow
    ? { userId: projectRow.userId, projectId, op: 'script_visual_enrichment' }
    : undefined

  const locations = await prisma.location.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { name: 'asc' }
  })
  const characters = await prisma.character.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: { images: { orderBy: { order: 'asc' } } }
  })

  const locationLines = locations
    .map((l) => `${l.name} | ${(l.description || '').slice(0, 200)}`)
    .join('\n')
  const characterLines = characters
    .map((c) => `${c.name} | ${(c.description || '').slice(0, 200)}`)
    .join('\n')

  let payload: VisualPayload
  try {
    const { jsonText } = await fetchScriptVisualEnrichmentJson(
      {
        scriptSummary: `${script.title}\n${script.summary}`,
        locationLines,
        characterLines
      },
      visualLog
    )
    const raw = extractJsonObject(jsonText)
    payload = JSON.parse(raw) as VisualPayload
  } catch (e) {
    console.warn('[applyScriptVisualEnrichment] AI 解析跳过:', e)
    return
  }

  if (Array.isArray(payload.locations)) {
    for (const loc of payload.locations) {
      if (!loc?.name || !loc.imagePrompt?.trim()) continue
      await prisma.location.updateMany({
        where: { projectId, name: loc.name, deletedAt: null },
        data: { imagePrompt: loc.imagePrompt.trim() }
      })
    }
  }

  if (!Array.isArray(payload.characters)) return

  for (const pc of payload.characters) {
    if (!pc?.name) continue
    const character = characters.find((c) => c.name === pc.name)
    if (!character) continue

    const images = sortCharacterImageSlots(Array.isArray(pc.images) ? pc.images : [])
    let baseImageId: string | null =
      character.images.find((i) => i.type === 'base' && !i.parentId)?.id || null
    let lastBasePrompt: string | null =
      character.images.find((i) => i.type === 'base' && !i.parentId)?.prompt?.trim() || null

    for (const slot of images) {
      if (!slot?.name || !slot.prompt?.trim()) continue
      const type = (slot.type || 'base').toLowerCase()
      const prompt = slot.prompt.trim()
      const desc = slot.description?.trim() || null

      if (type === 'base') {
        const existingBase = character.images.find((i) => i.type === 'base' && !i.parentId)
        if (existingBase) {
          await prisma.characterImage.update({
            where: { id: existingBase.id },
            data: { prompt, description: desc ?? existingBase.description, name: slot.name }
          })
          baseImageId = existingBase.id
          lastBasePrompt = prompt
        } else {
          const created = await prisma.characterImage.create({
            data: {
              characterId: character.id,
              name: slot.name,
              type: 'base',
              description: desc,
              prompt,
              avatarUrl: null,
              order: 0
            }
          })
          baseImageId = created.id
          lastBasePrompt = prompt
          character.images.push(created)
        }
        continue
      }

      if (isDerivedImageType(type)) {
        const parentId = baseImageId || character.images.find((i) => i.type === 'base' && !i.parentId)?.id || null
        if (!parentId) continue

        const finalPrompt = buildDerivativePrompt(lastBasePrompt, prompt)
        const maxOrder = await prisma.characterImage.aggregate({
          where: { characterId: character.id, parentId },
          _max: { order: true }
        })
        const created = await prisma.characterImage.create({
          data: {
            characterId: character.id,
            name: slot.name,
            parentId,
            type,
            description: desc,
            prompt: finalPrompt,
            avatarUrl: null,
            order: (maxOrder._max.order || 0) + 1
          }
        })
        character.images.push(created)
        if (!baseImageId) baseImageId = parentId
      }
    }
  }
}
