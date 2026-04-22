/**
 * 角色动作提取服务
 * 从剧本场景中提取角色动作、情绪等信息
 */

export {
  extractActionsFromScene,
  extractActionsFromScenes,
  extractCharacterActionSequence
} from './extractor.js'
export { classifyActionType } from './action-classifier.js'
export { parseActionText, extractImpliedActions } from './action-parser.js'
export { inferEmotionFromDialogue, inferEmotionFromAction } from './emotion-inferrer.js'
export { groupActionsByCharacter, mergeSceneActions } from './action-grouping.js'
export { determineVideoStyle } from './video-style-detector.js'
export { calculateSuggestedDuration, DURATION_LIMITS } from './duration-calculator.js'
export { suggestCameraMovement } from './camera-movement-suggester.js'

export type { ActionExtractorOptions } from './types.js'
