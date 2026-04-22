/**
 * 镜头运动建议器
 * 根据视频风格推荐合适的镜头运动
 */

import type { SceneActions } from '@dreamer/shared/types'

/** 镜头运动建议映射表 */
const CAMERA_MOVEMENT_SUGGESTIONS: Record<SceneActions['videoStyle'], string> = {
  dialogue: 'Medium close-up, subtle push-in on key dialogue',
  action: 'Dynamic tracking shot, smooth dolly follow',
  landscape: 'Slow wide pan, aerial crane reveal',
  mixed: 'Medium shot, gentle tracking movement'
}

/**
 * 建议镜头运动
 */
export function suggestCameraMovement(videoStyle: SceneActions['videoStyle']): string {
  return CAMERA_MOVEMENT_SUGGESTIONS[videoStyle]
}
