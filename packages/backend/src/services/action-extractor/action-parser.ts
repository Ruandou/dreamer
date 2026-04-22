/**
 * 动作文本解析器
 * 从场景文本中解析角色动作
 */

import type { CharacterAction } from '@dreamer/shared/types'
import { classifyActionType } from './action-classifier.js'
import { inferEmotionFromAction } from './emotion-inferrer.js'

/** 隐含动作提取模式 */
const ACTION_PATTERNS = [
  {
    regex: /([^，,。\s]+)低着头|([^，,。\s]+)抬起头|([^，,。\s]+)微笑着|([^，,。\s]+)眼中含着泪/g,
    type: 'expression' as const
  },
  {
    regex: /([^，,。\s]+)走进|([^，,。\s]+)冲出|([^，,。\s]+)站在/g,
    type: 'movement' as const
  },
  {
    regex: /([^，,。\s]+)惊讶|([^，,。\s]+)愣住|([^，,。\s]+)反应过来/g,
    type: 'reaction' as const
  }
]

/**
 * 解析动作文本，识别角色和动作类型
 */
export function parseActionText(actionText: string, characters: string[]): CharacterAction | null {
  for (const character of characters) {
    if (actionText.includes(character)) {
      return {
        characterName: character,
        actionType: classifyActionType(actionText),
        description: actionText,
        emotion: inferEmotionFromAction(actionText)
      }
    }
  }

  // 无法确定角色，作为通用动作处理
  return null
}

/**
 * 从场景描述中提取隐含动作
 */
export function extractImpliedActions(
  description: string,
  characters: string[]
): CharacterAction[] {
  const actions: CharacterAction[] = []

  for (const pattern of ACTION_PATTERNS) {
    let match
    while ((match = pattern.regex.exec(description)) !== null) {
      const characterName = match[1] || match[2] || match[3] || match[4]
      // 确认是已知角色
      if (characters.includes(characterName)) {
        actions.push({
          characterName,
          actionType: pattern.type,
          description: match[0],
          emotion: inferEmotionFromAction(match[0])
        })
      }
    }
  }

  return actions
}
