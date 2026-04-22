/**
 * 动作分组工具
 * 按角色分组动作并限制数量
 */

import type { CharacterAction } from '@dreamer/shared/types'

/**
 * 按角色分组动作，限制每个角色的动作数量
 */
export function groupActionsByCharacter(
  actions: CharacterAction[],
  maxPerCharacter: number
): CharacterAction[] {
  const grouped = new Map<string, CharacterAction[]>()

  // 分组
  for (const action of actions) {
    if (!grouped.has(action.characterName)) {
      grouped.set(action.characterName, [])
    }
    const charActions = grouped.get(action.characterName)
    if (charActions) {
      charActions.push(action)
    }
  }

  // 限制每个角色的动作数量
  const limited: CharacterAction[] = []
  for (const [, charActions] of grouped) {
    limited.push(...charActions.slice(0, maxPerCharacter))
  }

  return limited
}

/**
 * 合并多个连续场景的动作（用于长视频）
 */
export function mergeSceneActions(
  sceneActions: Array<{ actions: CharacterAction[] }>
): CharacterAction[] {
  const merged: CharacterAction[] = []

  for (const sa of sceneActions) {
    merged.push(...sa.actions)
  }

  // 去重
  const seen = new Set<string>()
  const unique: CharacterAction[] = []
  for (const action of merged) {
    const key = `${action.characterName}-${action.actionType}-${action.description.slice(0, 20)}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(action)
    }
  }

  return unique
}
