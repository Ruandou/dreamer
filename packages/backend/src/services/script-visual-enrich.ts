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
import { extractJsonObject } from './visual-enrich/json-extractor.js'
import { processLocationImagePrompts } from './visual-enrich/location-processor.js'
import { processCharacterImageSlots } from './visual-enrich/character-processor.js'
import { logInfo, logError, logWarning } from '../lib/error-logger.js'

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

interface VisualPayload {
  locations?: ParsedLocation[]
  characters?: ParsedCharacter[]
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
          logWarning('VisualEnrich', 'fillMissingCharacterImagePrompts 失败', {
            projectId,
            characterId: slot.characterId,
            imageId: slot.imageId,
            error: e instanceof Error ? e.message : String(e)
          })
        }
      })
    )

    // 记录失败情况
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        logError('VisualEnrich', 'fillMissingCharacterImagePrompts 批量处理失败', {
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
  logInfo('VisualEnrich', '开始视觉增强', { projectId })

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

  logInfo('VisualEnrich', '场地和角色数量', {
    locationCount: locations.length,
    characterCount: characters.length
  })

  // visualStyle 已废弃，只使用 visualStyleConfig
  const projectRowWithConfig = projectRow as { visualStyleConfig?: unknown }
  const visualStyleConfig = projectRowWithConfig.visualStyleConfig as VisualStyleConfig | null

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

  logInfo('VisualEnrich', '即将请求 DeepSeek', {
    projectId,
    op: 'script_visual_enrichment'
  })

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
    logInfo('VisualEnrich', 'DeepSeek 返回成功', { contentLength: jsonText.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    logError('VisualEnrich', 'DeepSeek 调用失败', {
      error: message,
      projectId
    })
    throw new Error(`视觉增强失败：DeepSeek 调用异常 - ${message}`, { cause: error })
  }

  let payload: VisualPayload
  try {
    const raw = extractJsonObject(jsonText)
    payload = JSON.parse(raw) as VisualPayload
    logInfo('VisualEnrich', 'JSON 解析成功', {
      locationCount: payload.locations?.length || 0,
      characterCount: payload.characters?.length || 0
    })
  } catch (e) {
    // 尝试 AI 修复 JSON
    logWarning('VisualEnrich', 'JSON 解析失败，尝试 AI 自动修复...')
    try {
      const fixedJson = await repairJsonWithAI(jsonText, {
        userId: projectRow.userId,
        projectId,
        op: 'visual_enrich_json_repair'
      })
      const raw = extractJsonObject(fixedJson)
      payload = JSON.parse(raw) as VisualPayload
      logInfo('VisualEnrich', 'JSON 修复成功')
    } catch {
      const err = e as Error
      logError('VisualEnrich', 'JSON 解析和修复均失败', {
        error: err?.message || String(err),
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
    logWarning('VisualEnrich', '项目场地库有场地但未收到模型返回的 locations 条目', {
      projectId,
      dbLocationNames
    })
  }

  const locationPromptWrites = await processLocationImagePrompts(
    projectId,
    payload.locations,
    dbLocationNames,
    sanitizeLocationImagePromptForImageApi
  )

  if (
    locations.length > 0 &&
    locationPromptWrites === 0 &&
    Array.isArray(payload.locations) &&
    payload.locations.length > 0
  ) {
    const returnedNames = payload.locations.map((l) => l?.name).filter(Boolean)
    logWarning(
      'VisualEnrich',
      '未能写入任何定场图 imagePrompt：请核对模型返回的 locations[].name 是否与场地库名称完全一致',
      {
        projectId,
        dbLocationNames,
        returnedNames
      }
    )
  }

  await processCharacterImageSlots(projectId, payload.characters, characters)

  await fillMissingCharacterImagePrompts(projectId, visualLog)
}
