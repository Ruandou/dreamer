import type { ScriptContent, ScriptScene } from '@dreamer/shared/types'

function mapName(raw: string, aliasToCanonical: Record<string, string>): string {
  const t = raw.trim()
  if (!t) return raw
  return aliasToCanonical[t] ?? t
}

/**
 * 将剧本中的称谓替换为规范角色名（scene.characters、对白、metadata.characters）
 */
export function normalizeScriptContent(
  script: ScriptContent,
  aliasToCanonical: Record<string, string>
): ScriptContent {
  if (!aliasToCanonical || Object.keys(aliasToCanonical).length === 0) {
    return script
  }

  const scenes: ScriptScene[] = (script.scenes || []).map((scene) => {
    const characters = (scene.characters || []).map((c) => mapName(c, aliasToCanonical))
    const seen = new Set<string>()
    const deduped = characters.filter((c) => {
      if (seen.has(c)) return false
      seen.add(c)
      return true
    })
    const dialogues = (scene.dialogues || []).map((d) => ({
      ...d,
      character: mapName(d.character, aliasToCanonical)
    }))
    return {
      ...scene,
      characters: deduped,
      dialogues
    }
  })

  const meta = script.metadata ? { ...script.metadata } : undefined
  if (meta && Array.isArray(meta.characters)) {
    const seen = new Set<string>()
    meta.characters = meta.characters
      .map((c) => mapName(c, aliasToCanonical))
      .filter((c) => {
        if (seen.has(c)) return false
        seen.add(c)
        return true
      })
  }

  return {
    ...script,
    metadata: meta,
    scenes
  }
}
