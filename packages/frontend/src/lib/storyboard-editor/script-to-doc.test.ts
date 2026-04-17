import { describe, it, expect } from 'vitest'
import { scriptToEditorDoc } from './script-to-doc'
import type { ScriptContent } from '@dreamer/shared/types'

describe('scriptToEditorDoc', () => {
  it('returns empty doc when no script', () => {
    const d = scriptToEditorDoc(undefined) as { type: string }
    expect(d.type).toBe('doc')
  })

  it('uses editorDoc when valid doc', () => {
    const ed = { type: 'doc', content: [{ type: 'paragraph' }] }
    const sc = {
      title: 't',
      summary: 's',
      scenes: [],
      editorDoc: ed
    } as ScriptContent
    expect(scriptToEditorDoc(sc)).toEqual(ed)
  })

  it('builds text from scenes when no editorDoc', () => {
    const sc: ScriptContent = {
      title: 't',
      summary: 's',
      scenes: [
        {
          sceneNum: 1,
          location: '屋内',
          timeOfDay: '夜',
          characters: [],
          description: '开场',
          dialogues: [],
          actions: []
        }
      ]
    }
    const d = scriptToEditorDoc(sc) as {
      content?: Array<{
        content?: Array<{
          type?: string
          text?: string
          attrs?: { label?: string }
        }>
      }>
    }
    // First paragraph contains a location node, not a text node
    const firstNode = d.content?.[0]?.content?.[0]
    expect(firstNode?.type).toBe('storyboardLocation')
    expect(firstNode?.attrs?.label).toBe('屋内')
  })
})
