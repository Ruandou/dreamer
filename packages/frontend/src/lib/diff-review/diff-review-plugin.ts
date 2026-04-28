/**
 * ProseMirror plugin for inline diff review.
 *
 * Shows AI-proposed changes as decorations:
 * - Additions: green inline widget
 * - Removals: red strikethrough highlight on existing text
 * - Per-change accept/reject buttons
 */

import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { ChangeGroup } from './diff-computer'

export interface DiffReviewState {
  isReviewing: boolean
  proposedText: string
  changeGroups: ChangeGroup[]
  acceptedGroupIds: Set<string>
  rejectedGroupIds: Set<string>
}

export const diffReviewKey = new PluginKey<DiffReviewState>('diffReview')

export type DiffReviewMeta =
  | { type: 'start-review'; proposedText: string; changeGroups: ChangeGroup[] }
  | { type: 'accept-group'; groupId: string }
  | { type: 'reject-group'; groupId: string }
  | { type: 'accept-all' }
  | { type: 'reject-all' }
  | { type: 'end-review' }

function createActionWidget(groupId: string): HTMLElement {
  const container = document.createElement('span')
  container.className = 'diff-action-widget'
  container.contentEditable = 'false'
  container.setAttribute('data-group-id', groupId)

  const acceptBtn = document.createElement('button')
  acceptBtn.className = 'diff-btn diff-btn-accept'
  acceptBtn.innerHTML = '&#10003;'
  acceptBtn.title = '接受'
  acceptBtn.type = 'button'
  acceptBtn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('diff:accept-group', { detail: { groupId } }))
  }

  const rejectBtn = document.createElement('button')
  rejectBtn.className = 'diff-btn diff-btn-reject'
  rejectBtn.innerHTML = '&#10005;'
  rejectBtn.title = '拒绝'
  rejectBtn.type = 'button'
  rejectBtn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('diff:reject-group', { detail: { groupId } }))
  }

  container.appendChild(acceptBtn)
  container.appendChild(rejectBtn)
  return container
}

function buildDecorations(state: EditorState, pluginState: DiffReviewState): DecorationSet {
  if (!pluginState.isReviewing) return DecorationSet.empty

  const decorations: Decoration[] = []
  const doc = state.doc

  for (const group of pluginState.changeGroups) {
    // Skip already acted groups
    if (pluginState.acceptedGroupIds.has(group.id) || pluginState.rejectedGroupIds.has(group.id)) {
      continue
    }

    // Safety clamp positions to document bounds
    const from = Math.max(0, Math.min(group.from, doc.content.size))
    const to = Math.max(from, Math.min(group.to, doc.content.size))

    // Decorate removals within the group's range
    // We scan the document range and highlight text nodes
    doc.nodesBetween(from, to, (node, pos) => {
      if (node.isText) {
        const nodeFrom = Math.max(pos, from)
        const nodeTo = Math.min(pos + node.nodeSize, to)
        if (nodeFrom < nodeTo) {
          decorations.push(
            Decoration.inline(nodeFrom, nodeTo, {
              class: 'diff-remove',
              'data-diff-remove': ''
            })
          )
        }
      }
      return true
    })

    // Render additions as widget at the end of the group's range
    if (group.proposedText) {
      const addWidget = document.createElement('span')
      addWidget.className = 'diff-add'
      addWidget.textContent = group.proposedText
      decorations.push(Decoration.widget(to, () => addWidget, { side: 1, key: `add-${group.id}` }))
    }

    // Action buttons widget at end of group
    decorations.push(
      Decoration.widget(to, () => createActionWidget(group.id), {
        side: 1,
        key: `actions-${group.id}`
      })
    )
  }

  return DecorationSet.create(doc, decorations)
}

export function createDiffReviewPlugin(): Plugin {
  return new Plugin<DiffReviewState>({
    key: diffReviewKey,

    state: {
      init() {
        return {
          isReviewing: false,
          proposedText: '',
          changeGroups: [],
          acceptedGroupIds: new Set(),
          rejectedGroupIds: new Set()
        }
      },

      apply(tr, value) {
        const meta = tr.getMeta(diffReviewKey) as DiffReviewMeta | undefined
        if (!meta) return value

        switch (meta.type) {
          case 'start-review':
            return {
              isReviewing: true,
              proposedText: meta.proposedText,
              changeGroups: meta.changeGroups,
              acceptedGroupIds: new Set(),
              rejectedGroupIds: new Set()
            }

          case 'accept-group': {
            const accepted = new Set(value.acceptedGroupIds)
            accepted.add(meta.groupId)
            return { ...value, acceptedGroupIds: accepted }
          }

          case 'reject-group': {
            const rejected = new Set(value.rejectedGroupIds)
            rejected.add(meta.groupId)
            return { ...value, rejectedGroupIds: rejected }
          }

          case 'accept-all':
            return {
              ...value,
              acceptedGroupIds: new Set(value.changeGroups.map((g) => g.id))
            }

          case 'reject-all':
            return {
              ...value,
              rejectedGroupIds: new Set(value.changeGroups.map((g) => g.id))
            }

          case 'end-review':
            return {
              isReviewing: false,
              proposedText: '',
              changeGroups: [],
              acceptedGroupIds: new Set(),
              rejectedGroupIds: new Set()
            }

          default:
            return value
        }
      }
    },

    props: {
      decorations(state) {
        const pluginState = diffReviewKey.getState(state)
        if (!pluginState?.isReviewing) return DecorationSet.empty
        return buildDecorations(state, pluginState)
      },

      handleKeyDown(view, event) {
        // Prevent editing during review mode
        const state = diffReviewKey.getState(view.state)
        if (state?.isReviewing) {
          // Allow Escape to cancel review
          if (event.key === 'Escape') {
            window.dispatchEvent(new CustomEvent('diff:cancel-review'))
            return true
          }
          // Block most editing keys
          if (
            event.key.length === 1 ||
            event.key === 'Backspace' ||
            event.key === 'Delete' ||
            event.key === 'Enter'
          ) {
            return true
          }
        }
        return false
      }
    }
  })
}

/**
 * Get the current diff review state from an editor view.
 */
export function getDiffReviewState(view: EditorView): DiffReviewState | undefined {
  return diffReviewKey.getState(view.state)
}

/**
 * Check if there are any pending (unacted) change groups.
 */
export function hasPendingChanges(state: DiffReviewState): boolean {
  return state.changeGroups.some(
    (g) => !state.acceptedGroupIds.has(g.id) && !state.rejectedGroupIds.has(g.id)
  )
}

/**
 * Get counts of additions and deletions for display.
 */
export function getDiffCounts(state: DiffReviewState): {
  pending: number
  additions: number
  deletions: number
} {
  let additions = 0
  let deletions = 0
  let pending = 0

  for (const group of state.changeGroups) {
    if (state.acceptedGroupIds.has(group.id) || state.rejectedGroupIds.has(group.id)) continue
    pending++
    for (const change of group.changes) {
      if (change.type === 'add') additions += change.value.length
      else if (change.type === 'remove') deletions += change.value.length
    }
  }

  return { pending, additions, deletions }
}
