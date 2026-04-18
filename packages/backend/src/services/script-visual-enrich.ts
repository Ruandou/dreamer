/**
 * 解析剧本后：用 DeepSeek 补全角色多形象 prompt 与场地定场图 imagePrompt
 */

import type { ScriptContent } from '@dreamer/shared/types'
import type { VisualStyleConfig } from '@dreamer/shared'
import { projectRepository } from '../repositories/project-repository.js'
import { locationRepository } from '../repositories/location-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { fetchScriptVisualEnrichmentJson, generateCharacterSlotImagePrompt } from './ai/deepseek.js'
import { repairJsonWithAI } from './ai/json-repair.js'
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
function buildDerivativePrompt(
  baseAnchor: string | null | undefined,
  derivativePrompt: string
): string {
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
function resolveDbLocationName(
  dbNames: readonly string[],
  aiName: string | undefined
): string | null {
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

/** 视觉补全后仍为空的槽位，用单槽提示词生成补写（须已具备 description 或角色描述） */
async function fillMissingCharacterImagePrompts(
  projectId: string,
  log: ModelCallLogContext
): Promise<void> {
  const characters = await characterRepository.findManyByProjectNameAscWithImages(projectId)
  const fallbackLog: ModelCallLogContext = {
    ...log,
    op: 'character_slot_prompt_fallback'
  }

  // 收集所有需要生成prompt的图片槽位
  const slotsToFill: Array<{
    characterId: string
    imageId: string
    params: {
      characterName: string
      characterDescription: string | null
      slotName: string
      slotType: string
      slotDescription: string | null
      parentSlotSummary: string | undefined
    }
  }> = []

  for (const c of characters) {
    const baseImg = c.images.find((i) => i.type === 'base' && !i.parentId)
    const basePrompt = baseImg?.prompt?.trim() || null

    for (const img of c.images) {
      if (img.prompt?.trim()) continue

      const parentSlotSummary =
        img.parentId && img.type !== 'base'
          ? c.images.find((i) => i.id === img.parentId)?.prompt?.trim() || basePrompt
          : basePrompt

      slotsToFill.push({
        characterId: c.id,
        imageId: img.id,
        params: {
          characterName: c.name,
          characterDescription: c.description,
          slotName: img.name,
          slotType: img.type || 'base',
          slotDescription: img.description,
          parentSlotSummary: parentSlotSummary || undefined
        }
      })
    }
  }

  // 并行生成所有缺失的prompt（限制并发数避免API限流）
  const CONCURRENCY_LIMIT = 5
  for (let i = 0; i < slotsToFill.length; i += CONCURRENCY_LIMIT) {
    const batch = slotsToFill.slice(i, i + CONCURRENCY_LIMIT)
    const results = await Promise.allSettled(
      batch.map(async (slot) => {
        try {
          const { prompt } = await generateCharacterSlotImagePrompt(slot.params, fallbackLog)
          if (prompt?.trim()) {
            await characterRepository.updateCharacterImage(slot.imageId, {
              prompt
            })
          }
        } catch (e) {
          console.warn('[fillMissingCharacterImagePrompts] 失败', {
            projectId,
            characterId: slot.characterId,
            imageId: slot.imageId,
            error: e
          })
        }
      })
    )

    // 记录失败情况
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error('[fillMissingCharacterImagePrompts] 批量处理失败', {
          batchStart: i,
          index: idx,
          error: result.reason
        })
      }
    })
  }
}

export async function applyScriptVisualEnrichment(
  projectId: string,
  script: ScriptContent
): Promise<void> {
  console.log(`[visual-enrich] 开始视觉增强, projectId=${projectId}`)

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

  console.log(`[visual-enrich] 场地数: ${locations.length}, 角色数: ${characters.length}`)

  // visualStyle 已废弃，只使用 visualStyleConfig
  const visualStyleConfig = (projectRow as any).visualStyleConfig as VisualStyleConfig | null

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
    `[visual-enrich] 即将请求 DeepSeek（落库 op=script_visual_enrichment） projectId=${projectId}`
  )

  let jsonText: string
  try {
    const result = await fetchScriptVisualEnrichmentJson(
      {
        scriptSummary: `${script.title}\n${script.summary}`,
        locationLines,
        characterLines,
        projectVisualStyleLine: '', // visualStyle已废弃
        visualStyleConfig,
        exactLocationNames: locations.map((l) => l.name)
      },
      visualLog
    )
    jsonText = result.jsonText
    console.log(`[visual-enrich] DeepSeek 返回成功, 内容长度: ${jsonText.length} chars`)
  } catch (error: any) {
    console.error('[visual-enrich] DeepSeek 调用失败:', {
      error: error.message,
      projectId
    })
    throw new Error(`视觉增强失败：DeepSeek 调用异常 - ${error.message}`, { cause: error })
  }

  let payload: VisualPayload
  try {
    const raw = extractJsonObject(jsonText)
    payload = JSON.parse(raw) as VisualPayload
    console.log(
      `[visual-enrich] JSON 解析成功, locations: ${payload.locations?.length || 0}, characters: ${payload.characters?.length || 0}`
    )
  } catch (e) {
    // 尝试 AI 修复 JSON
    console.warn('[visual-enrich] JSON 解析失败，尝试 AI 自动修复...')
    try {
      const fixedJson = await repairJsonWithAI(jsonText, {
        userId: projectRow.userId,
        projectId,
        op: 'visual_enrich_json_repair'
      })
      const raw = extractJsonObject(fixedJson)
      payload = JSON.parse(raw) as VisualPayload
      console.log('[visual-enrich] JSON 修复成功')
    } catch {
      const err = e as Error
      console.error('[visual-enrich] JSON 解析和修复均失败:', {
        error: err?.message || err,
        jsonTextPreview: jsonText.substring(0, 500)
      })
      throw new Error(
        `视觉补全失败：DeepSeek 返回不是合法 JSON（${err?.message || String(err)}）`,
        { cause: e }
      )
    }
  }

  const dbLocationNames = locations.map((l) => l.name)
  if (
    locations.length > 0 &&
    (!Array.isArray(payload.locations) || payload.locations.length === 0)
  ) {
    console.warn(
      '[applyScriptVisualEnrichment] 项目场地库有场地但未收到模型返回的 locations 条目',
      {
        projectId,
        dbLocationNames
      }
    )
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
        const parentId =
          baseImageId || character.images.find((i) => i.type === 'base' && !i.parentId)?.id || null
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

  await fillMissingCharacterImagePrompts(projectId, visualLog)
}
