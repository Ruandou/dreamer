/**
 * 时长计算器
 * 根据场景复杂度计算建议时长
 */

import type { ScriptScene, CharacterAction } from '@dreamer/shared/types'

/** 时长限制（秒） */
export const DURATION_LIMITS = {
  MIN: 4,
  MAX: 15,
  BASE: 5
} as const

/**
 * 计算建议时长
 */
export function calculateSuggestedDuration(scene: ScriptScene, actions: CharacterAction[]): number {
  let duration = DURATION_LIMITS.BASE

  // 根据动作数量调整
  if (actions.length > 3) {
    duration += 2
  }

  // 根据对话数量调整
  const dialogueCount = actions.filter((a) => a.actionType === 'dialogue').length
  if (dialogueCount >= 3) {
    duration += 3
  }

  // 根据场景描述长度调整
  if (scene.description.length > 100) {
    duration += 2
  }

  // 根据场景复杂度调整
  const complexity = scene.characters.length + scene.actions.length
  if (complexity > 5) {
    duration += 2
  }

  // 限制在合理范围内
  return Math.min(DURATION_LIMITS.MAX, Math.max(DURATION_LIMITS.MIN, duration))
}
