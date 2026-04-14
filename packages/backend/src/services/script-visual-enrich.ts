/**
 * 解析剧本后：用 DeepSeek 补全角色多形象 prompt 与场地定场图 imagePrompt
 */

import type { ScriptContent } from '@dreamer/shared/types'
import { projectRepository } from '../repositories/project-repository.js'
import { locationRepository } from '../repositories/location-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { fetchScriptVisualEnrichmentJson } from './ai/deepseek.js'
import type { ModelCallLogContext } from './ai/api-logger.js'

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

/** 去掉模型爱加的场景前缀，便于与库内场地名对齐 */
function stripLocationNameNoise(s: string): string {
  return s
    .replace(/^第[一二三四五六七八九十百千\d]+场[：:\s]*/u, '')
    .replace(/^(场景|内景|外景|场地|地点)[：:\s]*/u, '')
    .trim()
}

/**
 * 文生图 API（如火山方舟）常对「审讯室」「刑讯」等字面触发审核；落库前做中性化替换，不改变布景意图。
 * 较长词优先替换，避免子串残留。
 */
export function sanitizeLocationImagePromptForImageApi(text: string): string {
  let s = text
  const pairs: [string, string][] = [
    ['刑讯室', '会谈室'],
    ['审讯室', '会谈室'],
    ['看守所', '院落建筑'],
    ['禁闭室', '小房间'],
    ['关押室', '封闭房间'],
    ['羁押室', '等候室'],
    ['留置室', '等候室'],
    ['监狱', '封闭建筑内部'],
    ['刑讯', '问话'],
    ['审讯', '会谈']
  ]
  for (const [from, to] of pairs) {
    if (s.includes(from)) s = s.split(from).join(to)
  }
  return s
}

/** 模型返回的场地名与库内名称对齐（空白、句末标点、常见前缀） */
function resolveDbLocationName(dbNames: readonly string[], aiName: string | undefined): string | null {
  if (!aiName) return null
  const collapsed = (s: string) => s.replace(/\s+/g, ' ').trim()
  const stripTrailingPeriod = (s: string) => collapsed(s).replace(/[.。．]+$/u, '')

  const tryOne = (raw: string): string | null => {
    const t = collapsed(raw)
    if (!t) return null
    if (dbNames.includes(t)) return t
    const ct = collapsed(t)
    for (const n of dbNames) {
      if (collapsed(n) === ct) return n
    }
    const nt = stripTrailingPeriod(t)
    for (const n of dbNames) {
      if (stripTrailingPeriod(n) === nt) return n
    }
    const stripped = stripLocationNameNoise(t)
    if (stripped !== t) {
      const st = stripTrailingPeriod(stripped)
      for (const n of dbNames) {
        if (stripTrailingPeriod(n) === st || collapsed(n) === collapsed(stripped)) return n
      }
    }
    return null
  }

  return tryOne(aiName)
}

export async function applyScriptVisualEnrichment(projectId: string, script: ScriptContent): Promise<void> {
  const projectRow = await projectRepository.findUserIdAndVisualStyle(projectId)
  if (!projectRow) {
    throw new Error('视觉补全失败：项目不存在，无法写入模型审计日志与定场/定妆提示词')
  }
  const visualLog: ModelCallLogContext = {
    userId: projectRow.userId,
    projectId,
    op: 'script_visual_enrichment'
  }

  const locations = await locationRepository.findManyByProjectOrdered(projectId)
  const characters = await characterRepository.findManyByProjectNameAscWithImages(projectId)

  const projectVisualStyleLine =
    (projectRow.visualStyle || []).filter(Boolean).join('、') || '（未指定，定场图第4段可写通用电影级画质词）'

  const locationLines = locations
    .map((l) => {
      const time = (l.timeOfDay || '').trim() || '未指定'
      const desc = (l.description || '').slice(0, 300)
      return `${l.name} | 时间：${time} | 描述：${desc}`
    })
    .join('\n')
  const characterLines = characters
    .map((c) => `${c.name} | ${(c.description || '').slice(0, 200)}`)
    .join('\n')

  console.log(
    `[script_visual_enrichment] 即将请求 DeepSeek（落库 op=script_visual_enrichment） projectId=${projectId}`
  )
  const { jsonText } = await fetchScriptVisualEnrichmentJson(
    {
      scriptSummary: `${script.title}\n${script.summary}`,
      locationLines,
      characterLines,
      projectVisualStyleLine,
      exactLocationNames: locations.map((l) => l.name)
    },
    visualLog
  )

  let payload: VisualPayload
  try {
    const raw = extractJsonObject(jsonText)
    payload = JSON.parse(raw) as VisualPayload
  } catch (e) {
    const err = e as Error
    console.warn('[applyScriptVisualEnrichment] 模型返回内容无法解析为 JSON:', err?.message || err)
    throw new Error(`视觉补全失败：DeepSeek 返回不是合法 JSON（${err?.message || String(err)}）`)
  }

  const dbLocationNames = locations.map((l) => l.name)
  if (locations.length > 0 && (!Array.isArray(payload.locations) || payload.locations.length === 0)) {
    console.warn('[applyScriptVisualEnrichment] 项目场地库有场地但未收到模型返回的 locations 条目', {
      projectId,
      dbLocationNames
    })
  }

  let locationPromptWrites = 0
  if (Array.isArray(payload.locations)) {
    for (const loc of payload.locations) {
      const raw = loc?.imagePrompt?.trim()
      if (!raw) continue
      const prompt = sanitizeLocationImagePromptForImageApi(raw)
      const resolvedName = resolveDbLocationName(dbLocationNames, loc?.name)
      if (!resolvedName) continue
      const r = await locationRepository.updateManyActiveImagePromptByProjectAndName(
        projectId,
        resolvedName,
        prompt
      )
      locationPromptWrites += r.count
    }
  }

  if (
    locations.length > 0 &&
    locationPromptWrites === 0 &&
    Array.isArray(payload.locations) &&
    payload.locations.length > 0
  ) {
    const returnedNames = payload.locations.map((l) => l?.name).filter(Boolean)
    console.warn(
      '[applyScriptVisualEnrichment] 未能写入任何定场图 imagePrompt：请核对模型返回的 locations[].name 是否与场地库名称完全一致',
      { projectId, dbLocationNames, returnedNames }
    )
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
          await characterRepository.updateCharacterImage(existingBase.id, {
            prompt,
            description: desc ?? existingBase.description ?? undefined,
            name: slot.name
          })
          baseImageId = existingBase.id
          lastBasePrompt = prompt
        } else {
          const created = await characterRepository.createCharacterImage({
            characterId: character.id,
            name: slot.name,
            type: 'base',
            description: desc ?? undefined,
            prompt,
            avatarUrl: null,
            order: 0
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
        const maxOrder = await characterRepository.maxSiblingOrder(character.id, parentId)
        const created = await characterRepository.createCharacterImage({
          characterId: character.id,
          name: slot.name,
          parentId,
          type,
          description: desc ?? undefined,
          prompt: finalPrompt,
          avatarUrl: null,
          order: (maxOrder._max.order || 0) + 1
        })
        character.images.push(created)
        if (!baseImageId) baseImageId = parentId
      }
    }
  }
}
