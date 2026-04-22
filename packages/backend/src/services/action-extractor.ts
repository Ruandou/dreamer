/**
 * 角色动作提取服务
 * @deprecated 使用 action-extractor/ 下的新模块
 * 保留此文件以维持向后兼容
 */

// Re-export all functions from the new modular structure
export {
  extractActionsFromScene,
  extractActionsFromScenes,
  extractCharacterActionSequence,
  classifyActionType,
  parseActionText,
  extractImpliedActions,
  inferEmotionFromDialogue,
  inferEmotionFromAction,
  groupActionsByCharacter,
  mergeSceneActions,
  determineVideoStyle,
  calculateSuggestedDuration,
  suggestCameraMovement,
  DURATION_LIMITS
} from './action-extractor/index.js'

export type { ActionExtractorOptions } from './action-extractor/types.js'
