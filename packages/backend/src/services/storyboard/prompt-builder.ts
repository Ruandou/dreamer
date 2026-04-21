/**
 * Seedance prompt builder — pure function for constructing video generation prompts
 */

import type {
  ScriptScene,
  SceneAsset,
  StoryboardSegment,
  SceneActions
} from '@dreamer/shared/types'
import type { StoryboardGeneratorOptions } from '../storyboard-generator.js'

/**
 * Build a Seedance video generation prompt from scene data.
 */
export function generateSeedancePrompt(
  scene: ScriptScene,
  _sceneActions: SceneActions,
  characters: StoryboardSegment['characters'],
  visualStyle: string | string[],
  cameraMovement: string,
  assets: SceneAsset[],
  options?: StoryboardGeneratorOptions
): string {
  const parts: string[] = []
  const styleStr = Array.isArray(visualStyle) ? visualStyle.join('，') : visualStyle

  // 1. Style / tone overview
  parts.push(styleStr)

  // 2. Character descriptions
  const characterDescriptions = characters.map((c) => {
    const desc = [c.name]
    if (c.actions.length > 0) {
      const mainAction = c.actions[0]
      desc.push(mainAction.description)
    }
    // Add reference image marker
    const asset = assets.find((a) => a.url === c.referenceImageUrl)
    if (asset) {
      const index = assets.filter((a) => a.url).indexOf(asset) + 1
      desc.push(`@图片${index}`)
    }
    return desc.join('，')
  })
  parts.push(characterDescriptions.join('，'))

  // 3. Scene description
  parts.push(scene.description)

  // 4. Camera movement
  parts.push(cameraMovement)

  // 5. Environment / lighting
  if (scene.timeOfDay === '夜') {
    parts.push('月光/灯光照明，神秘氛围')
  } else if (scene.timeOfDay === '日') {
    parts.push('自然采光，明亮氛围')
  }

  // 6. Background asset reference
  const backgroundAsset = assets.find((a) => a.type === 'background')
  if (backgroundAsset?.url) {
    const index = assets.filter((a) => a.url).indexOf(backgroundAsset) + 1
    parts.push(`背景参考 @图片${index}`)
  }

  // 7. Audio hint (if dialogues present)
  if (scene.dialogues.length > 0 && options?.enableDialogueFormat) {
    parts.push('音效：对话为主，环境音为辅')
  }

  return parts.join('，')
}
