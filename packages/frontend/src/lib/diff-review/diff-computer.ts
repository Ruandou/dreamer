/**
 * Paragraph-level diff computation for inline diff review.
 * Uses `diffLines` to group changes at paragraph granularity.
 */

import { diffLines, type Change } from 'diff'

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged'
  value: string
}

export interface ChangeGroup {
  id: string
  from: number
  to: number
  originalText: string
  proposedText: string
  changes: DiffChange[]
  status: 'pending' | 'accepted' | 'rejected'
}

/**
 * Compute paragraph-level change groups from original and revised text.
 *
 * Positions (`from`/`to`) are **character offsets in the original plain text**,
 * not ProseMirror document positions. The caller must map them to PM positions
 * using `mapTextPosToDocPos`.
 */
export function computeChangeGroups(original: string, revised: string): ChangeGroup[] {
  const lineDiffs: Change[] = diffLines(original, revised, { newlineIsToken: false })
  const groups: ChangeGroup[] = []

  let originalPos = 0
  let currentGroup: ChangeGroup | null = null

  function flushGroup() {
    if (!currentGroup) return
    currentGroup.to = originalPos
    groups.push(currentGroup)
    currentGroup = null
  }

  for (const diff of lineDiffs) {
    const value = diff.value
    const isChange = diff.added || diff.removed

    if (isChange) {
      if (!currentGroup) {
        currentGroup = {
          id: `cg-${groups.length}`,
          from: originalPos,
          to: originalPos,
          originalText: '',
          proposedText: '',
          changes: [],
          status: 'pending'
        }
      }

      currentGroup.changes.push({
        type: diff.added ? 'add' : 'remove',
        value
      })

      if (diff.removed) {
        currentGroup.originalText += value
        originalPos += value.length
      } else {
        currentGroup.proposedText += value
      }
    } else {
      // Unchanged text — close current group if any
      flushGroup()
      originalPos += value.length
    }
  }

  flushGroup()
  return groups
}

/**
 * Map a flat text character offset to a ProseMirror document position.
 *
 * In a Tiptap document with only paragraphs, PM positions account for
 * paragraph node boundaries (+2 per paragraph: open/close tag).
 *
 * @param doc - ProseMirror document
 * @param textOffset - Character offset in the flat textContent
 * @returns ProseMirror document position
 */
interface ProseMirrorNode {
  isText: boolean
  text?: string
  isBlock: boolean
  descendants(fn: (node: ProseMirrorNode, pos: number) => boolean | void): void
}

export function mapTextPosToDocPos(doc: ProseMirrorNode, textOffset: number): number {
  let pos = 1 // Start inside the doc node
  let accumulated = 0

  doc.descendants((node, nodePos) => {
    if (accumulated >= textOffset) return false

    if (node.isText) {
      const text = node.text ?? ''
      const nodeEnd = accumulated + text.length
      if (textOffset <= nodeEnd) {
        pos = nodePos + (textOffset - accumulated)
        accumulated = textOffset
        return false
      }
      accumulated = nodeEnd
      pos = nodePos + text.length
    } else if (node.isBlock) {
      pos = nodePos + 1 // Enter the block
    }
    return true
  })

  return pos
}

/**
 * Convert all `from`/`to` offsets in change groups from flat text positions
 * to ProseMirror document positions.
 */
export function mapChangeGroupsToDocPositions(
  doc: ProseMirrorNode,
  groups: ChangeGroup[]
): ChangeGroup[] {
  return groups.map((g) => ({
    ...g,
    from: mapTextPosToDocPos(doc, g.from),
    to: mapTextPosToDocPos(doc, g.to)
  }))
}
