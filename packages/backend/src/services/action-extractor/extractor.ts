/**
 * 动作提取主函数
 * 协调各个子模块完成动作提取
 */

import type { ScriptScene, CharacterAction, SceneActions, Character } from '@dreamer/shared/types'
import type { ActionExtractorOptions } from './types.js'
import { parseActionText, extractImpliedActions } from './action-parser.js'
import { inferEmotionFromDialogue } from './emotion-inferrer.js'
import { groupActionsByCharacter } from './action-grouping.js'
import { determineVideoStyle } from './video-style-detector.js'
import { calculateSuggestedDuration } from './duration-calculator.js'
import { suggestCameraMovement } from './camera-movement-suggester.js'

/**
 * 从场景中提取角色动作
 */
export function extractActionsFromScene(
  scene: ScriptScene,
  characters?: Character[],
  options?: ActionExtractorOptions
): SceneActions {
  const maxActions = options?.maxActionsPerCharacter ?? 5

  const actions: CharacterAction[] = []

  // 提取对话动作
  for (const dialogue of scene.dialogues) {
    const action: CharacterAction = {
      characterName: dialogue.character,
      actionType: 'dialogue',
      description: dialogue.content,
      emotion: inferEmotionFromDialogue(dialogue.content)
    }
    actions.push(action)
  }

  // 提取描述性动作
  for (const actionText of scene.actions) {
    const parsed = parseActionText(actionText, scene.characters)
    if (parsed) {
      actions.push(parsed)
    }
  }

  // 从场景描述中提取隐含动作
  const impliedActions = extractImpliedActions(scene.description, scene.characters)
  actions.push(...impliedActions)

  // 按角色分组并限制数量
  const groupedActions = groupActionsByCharacter(actions, maxActions)

  // 确定视频风格
  const videoStyle = determineVideoStyle(scene, groupedActions)

  // 确定建议时长
  const suggestedDuration = calculateSuggestedDuration(scene, groupedActions)

  return {
    sceneNum: scene.sceneNum,
    actions: groupedActions,
    suggestedDuration,
    videoStyle,
    suggestedCameraMovement: suggestCameraMovement(videoStyle),
    suggestedAspectRatio: '9:16'
  }
}

/**
 * 从多个场景中提取动作
 */
export function extractActionsFromScenes(
  scenes: ScriptScene[],
  characters?: Character[],
  options?: ActionExtractorOptions
): SceneActions[] {
  return scenes.map((scene) => extractActionsFromScene(scene, characters, options))
}

/**
 * 提取角色在场景中的动作序列
 */
export function extractCharacterActionSequence(
  scene: ScriptScene,
  characterName: string
): CharacterAction[] {
  const allActions = extractActionsFromScene(scene)

  return allActions.actions.filter((action) => action.characterName === characterName)
}
