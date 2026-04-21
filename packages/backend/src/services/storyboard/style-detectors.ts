/**
 * Visual style, camera movement, and special effects detectors — pure functions
 */

import type { ScriptScene, SceneActions } from '@dreamer/shared/types'

/**
 * Determine visual style tags based on scene description, time, and video style.
 */
export function determineVisualStyle(scene: ScriptScene, sceneActions: SceneActions): string[] {
  const styles: string[] = []

  // Based on era/genre
  if (scene.description.includes('古风') || scene.description.includes('古装')) {
    styles.push('古风', '中国风')
  }
  if (scene.description.includes('现代')) {
    styles.push('现代都市')
  }
  if (scene.description.includes('科幻') || scene.description.includes('未来')) {
    styles.push('科幻', '赛博朋克')
  }
  if (scene.description.includes('仙侠')) {
    styles.push('仙侠', '玄幻')
  }

  // Based on time of day
  if (scene.timeOfDay === '夜') {
    styles.push('夜景氛围', '暗色调')
  } else if (scene.timeOfDay === '日') {
    styles.push('明亮色调')
  } else if (scene.timeOfDay === '昏') {
    styles.push('黄昏暖调')
  }

  // Based on video style
  if (sceneActions.videoStyle === 'action') {
    styles.push('动感', '高对比')
  } else if (sceneActions.videoStyle === 'dialogue') {
    styles.push('柔和', '浅景深')
  }

  return styles.length > 0 ? styles : ['电影感']
}

/**
 * Determine camera movement description based on scene actions and character count.
 */
export function determineCameraMovement(scene: ScriptScene, sceneActions: SceneActions): string {
  // Use existing suggestion if available
  if (sceneActions.suggestedCameraMovement) {
    return sceneActions.suggestedCameraMovement
  }

  const movements: string[] = []

  // Based on video style
  switch (sceneActions.videoStyle) {
    case 'dialogue':
      movements.push('Medium close-up', 'subtle push-in on speaker')
      break
    case 'action':
      movements.push('Dynamic tracking shot', 'smooth dolly follow')
      break
    case 'landscape':
      movements.push('Slow wide pan', 'aerial crane reveal')
      break
    default:
      movements.push('Medium shot', 'gentle tracking movement')
  }

  // Adjust based on character count
  if (scene.characters.length > 2) {
    movements.push('group framing')
  }

  return movements.join(', ')
}

/**
 * Determine special effects based on scene description keywords.
 */
export function determineSpecialEffects(scene: ScriptScene): string[] {
  const effects: string[] = []

  const effectKeywords: [string, string][] = [
    ['雨', '雨水效果'],
    ['雪', '飘雪效果'],
    ['雾', '薄雾弥漫'],
    ['风', '风吹效果'],
    ['光', '光束效果'],
    ['火', '火焰效果'],
    ['爆炸', '爆炸粒子'],
    ['慢动作', '升格拍摄'],
    ['雨滴', '雨滴溅射']
  ]

  for (const [keyword, effect] of effectKeywords) {
    if (scene.description.includes(keyword)) {
      effects.push(effect)
    }
  }

  return effects
}
