/**
 * Script content validator — pure functions for validating ScriptContent structure
 */

import type { ScriptContent } from '@dreamer/shared/types'

/**
 * Validate that a ScriptContent has required fields and structure.
 * Throws descriptive errors for missing or invalid data.
 */
export function validateScript(script: ScriptContent): void {
  if (!script.title) {
    throw new Error('剧本缺少标题')
  }

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('剧本缺少场景')
  }

  for (const scene of script.scenes) {
    if (!scene.location) {
      throw new Error(`场景${scene.sceneNum}缺少地点描述`)
    }
    if (!scene.description) {
      throw new Error(`场景${scene.sceneNum}缺少场景描述`)
    }
  }
}
