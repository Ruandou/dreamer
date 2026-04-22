/**
 * 动作类型分类器
 * 根据动作文本内容分类动作类型
 */

import type { CharacterAction } from '@dreamer/shared/types'

/** 对话类关键词 */
const DIALOGUE_KEYWORDS = ['说', '道', '喊', '叫', 'ask', 'say', 'tell', 'speak']

/** 表情类关键词 */
const EXPRESSION_KEYWORDS = ['看', '望', '笑', '哭', 'look', 'smile', 'cry', 'weep', 'gaze']

/** 移动类关键词 */
const MOVEMENT_KEYWORDS = ['走', '跑', '跳', '坐', '站', 'walk', 'run', 'jump', 'sit', 'stand']

/** 反应类关键词 */
const REACTION_KEYWORDS = ['惊', '愣', '反应', 'surprise', 'react', 'shock', 'stunned']

/**
 * 分类动作类型
 */
export function classifyActionType(actionText: string): CharacterAction['actionType'] {
  const lowerText = actionText.toLowerCase()

  if (DIALOGUE_KEYWORDS.some((keyword) => lowerText.includes(keyword))) {
    return 'dialogue'
  }

  if (EXPRESSION_KEYWORDS.some((keyword) => lowerText.includes(keyword))) {
    return 'expression'
  }

  if (MOVEMENT_KEYWORDS.some((keyword) => lowerText.includes(keyword))) {
    return 'movement'
  }

  if (REACTION_KEYWORDS.some((keyword) => lowerText.includes(keyword))) {
    return 'reaction'
  }

  // 默认按动作处理
  return 'movement'
}
