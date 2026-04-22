/**
 * 视频风格检测器
 * 根据动作类型和场景内容确定视频风格
 */

import type { ScriptScene, CharacterAction, SceneActions } from '@dreamer/shared/types'

/**
 * 确定视频风格
 */
export function determineVideoStyle(
  scene: ScriptScene,
  actions: CharacterAction[]
): SceneActions['videoStyle'] {
  const actionTypes = actions.map((a) => a.actionType)

  // 对话为主
  const dialogueCount = actionTypes.filter((t) => t === 'dialogue').length
  if (dialogueCount > actions.length * 0.6) {
    return 'dialogue'
  }

  // 动作/运动为主
  const movementCount = actionTypes.filter((t) => t === 'movement').length
  if (movementCount > actions.length * 0.4) {
    return 'action'
  }

  // 检查场景描述是否以风景/环境为主
  if (
    scene.description.length > 100 &&
    !scene.description.includes('角色') &&
    !scene.description.includes('人物')
  ) {
    return 'landscape'
  }

  return 'mixed'
}
