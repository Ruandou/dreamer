/**
 * ProseMirror plugin for automatic script format styling.
 *
 * Auto-detects script element types from paragraph text and applies
 * CSS classes via node decorations. The document remains plain paragraphs,
 * but visually renders as formatted script elements.
 */

import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { detectScriptElementType } from './script-format-extension'

export const autoScriptFormatKey = new PluginKey<DecorationSet>('autoScriptFormat')

/**
 * Detect script element type from a line of text.
 * Re-exported from script-format-extension for convenience.
 */
export { detectScriptElementType }

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name !== 'paragraph') return true

    const text = node.textContent.trim()
    if (!text) return true

    const detected = detectScriptElementType(text)
    const scriptType = detected.type

    // Apply node decoration with CSS class based on detected type
    const className = `script-${scriptType}`
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: className,
        'data-script-type': scriptType
      })
    )

    return true
  })

  return DecorationSet.create(doc, decorations)
}

export function createAutoScriptFormatPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: autoScriptFormatKey,

    state: {
      init(_, { doc }) {
        return buildDecorations(doc)
      },
      apply(tr, value) {
        if (!tr.docChanged && !tr.getMeta(autoScriptFormatKey)) {
          return value.map(tr.mapping, tr.doc)
        }
        return buildDecorations(tr.doc)
      }
    },

    props: {
      decorations(state) {
        return autoScriptFormatKey.getState(state) ?? DecorationSet.empty
      }
    }
  })
}
