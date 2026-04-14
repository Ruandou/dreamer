/**
 * 从文学剧本 ScriptContent 落库 Character / Location（供 Pipeline 与解析任务复用）
 */

import { prisma } from '../index.js'
import type { ScriptContent } from '@dreamer/shared/types'

/**
 * 群演/路人等剧本占位名，不写入角色库（避免与主角色混排、占视觉增强名额）。
 * 仅匹配常见占位写法，避免误伤「群演队长」等有独立姓名的角色。
 */
export function isCrowdExtraCharacterName(raw: string): boolean {
  const name = raw.trim()
  if (!name) return true

  const exact = new Set([
    '群演',
    '群众',
    '群众演员',
    '路人',
    '龙套',
    'npc',
    'NPC'
  ])
  if (exact.has(name)) return true

  const low = name.toLowerCase()
  if (low === 'extras' || low === 'crowd') return true

  if (/^群演\d+$/.test(name)) return true
  if (/^路人[甲乙丙丁戊己庚辛壬癸]$/.test(name)) return true

  return false
}

export async function saveCharacters(projectId: string, script: ScriptContent) {
  const characterNames = new Set<string>()

  for (const scene of script.scenes) {
    for (const character of scene.characters || []) {
      if (isCrowdExtraCharacterName(character)) continue
      characterNames.add(character)
    }
  }

  for (const name of characterNames) {
    await prisma.character.upsert({
      where: {
        projectId_name: { projectId, name }
      },
      update: {},
      create: {
        projectId,
        name,
        description: `角色: ${name}`
      }
    })
  }
}

export async function saveLocations(projectId: string, script: ScriptContent) {
  const locationMap = new Map<string, { timeOfDay?: string; description?: string }>()

  for (const scene of script.scenes) {
    if (scene.location) {
      if (!locationMap.has(scene.location)) {
        locationMap.set(scene.location, {
          timeOfDay: scene.timeOfDay,
          description: scene.description
        })
      }
    }
  }

  for (const [locationName, info] of locationMap) {
    await prisma.location.upsert({
      where: {
        projectId_name: { projectId, name: locationName }
      },
      update: { timeOfDay: info.timeOfDay, description: info.description },
      create: {
        projectId,
        name: locationName,
        timeOfDay: info.timeOfDay || '日',
        description: info.description
      }
    })
  }
}
