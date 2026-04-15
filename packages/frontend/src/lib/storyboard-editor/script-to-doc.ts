import type { ScriptContent } from '@dreamer/shared/types'

const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })

/** 无 editorDoc 时，用剧本场景拼一段纯文本作为初始文档 */
export function scriptToEditorDoc(script: ScriptContent | null | undefined): Record<string, unknown> {
  if (script?.editorDoc && typeof script.editorDoc === 'object' && script.editorDoc !== null) {
    const d = script.editorDoc as { type?: string }
    if (d.type === 'doc') return script.editorDoc as Record<string, unknown>
  }
  if (!script?.scenes?.length) {
    return emptyDoc() as unknown as Record<string, unknown>
  }
  const parts: string[] = []
  for (const s of script.scenes) {
    const head = `${s.location} · ${s.timeOfDay}
${s.description || ''}`.trim()
    const shots = s.shots?.map((sh) => sh.description).filter(Boolean).join('\n') ?? ''
    parts.push(shots ? `${head}\n${shots}` : head)
  }
  const text = parts.join('\n\n')
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }]
  } as unknown as Record<string, unknown>
}
