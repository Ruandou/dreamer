/**
 * 从文学剧本 ScriptContent 落库 Character / Location（供 Pipeline 与解析任务复用）
 */

import { prisma } from '../index.js'
import type { ScriptContent } from '@dreamer/shared/types'

export async function saveCharacters(projectId: string, script: ScriptContent) {
  const characterNames = new Set<string>()

  for (const scene of script.scenes) {
    for (const character of scene.characters || []) {
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
