/**
 * Composable for AI-powered editor with inline diff review.
 *
 * Integrates with the existing chat SSE streaming infrastructure
 * and the custom ProseMirror diff review plugin.
 */

import { ref, computed } from 'vue'
import type { Editor } from '@tiptap/core'
import { useChatStream } from './useChatStream'
import { computeChangeGroups, mapChangeGroupsToDocPositions } from '@/lib/diff-review/diff-computer'
import { diffReviewKey } from '@/lib/diff-review/diff-review-plugin'
import { useChatStore } from '@/stores/chat'

export function useEditorAi() {
  const chatStore = useChatStore()
  const { start: startStream, abort: abortStream } = useChatStream()

  const isStreaming = ref(false)
  const proposedText = ref('')

  /**
   * Start a diff review session with proposed AI changes.
   */
  function startReview(editor: Editor, newProposedText: string) {
    const original = editor.state.doc.textContent
    proposedText.value = newProposedText

    let changeGroups = computeChangeGroups(original, newProposedText)
    changeGroups = mapChangeGroupsToDocPositions(editor.state.doc, changeGroups)

    // Filter out empty groups
    changeGroups = changeGroups.filter((g) => g.originalText.trim() || g.proposedText.trim())

    editor.view.dispatch(
      editor.state.tr.setMeta(diffReviewKey, {
        type: 'start-review',
        proposedText: newProposedText,
        changeGroups
      })
    )

    editor.setEditable(false)
  }

  /**
   * Accept a single change group — replace original text with proposed text.
   */
  function acceptGroup(editor: Editor, groupId: string) {
    const state = diffReviewKey.getState(editor.state)
    if (!state) return

    const group = state.changeGroups.find((g) => g.id === groupId)
    if (!group) return

    // Apply the text replacement
    const tr = editor.state.tr
    const from = Math.max(0, Math.min(group.from, editor.state.doc.content.size))
    const to = Math.max(from, Math.min(group.to, editor.state.doc.content.size))

    if (group.proposedText) {
      tr.replaceWith(from, to, editor.schema.text(group.proposedText))
    } else {
      tr.delete(from, to)
    }

    tr.setMeta(diffReviewKey, { type: 'accept-group', groupId })
    editor.view.dispatch(tr)

    // Check if all resolved
    checkEndReview(editor)
  }

  /**
   * Reject a single change group.
   */
  function rejectGroup(editor: Editor, groupId: string) {
    editor.view.dispatch(editor.state.tr.setMeta(diffReviewKey, { type: 'reject-group', groupId }))
    checkEndReview(editor)
  }

  /**
   * Accept all pending changes.
   */
  function acceptAll(editor: Editor) {
    const state = diffReviewKey.getState(editor.state)
    if (!state) return

    const pendingGroups = state.changeGroups
      .filter((g) => !state.acceptedGroupIds.has(g.id) && !state.rejectedGroupIds.has(g.id))
      .sort((a, b) => b.from - a.from) // reverse order to preserve positions

    let tr = editor.state.tr
    for (const group of pendingGroups) {
      const from = Math.max(0, Math.min(group.from, editor.state.doc.content.size))
      const to = Math.max(from, Math.min(group.to, editor.state.doc.content.size))

      if (group.proposedText) {
        tr = tr.replaceWith(from, to, editor.schema.text(group.proposedText))
      } else {
        tr = tr.delete(from, to)
      }
    }

    tr.setMeta(diffReviewKey, { type: 'accept-all' })
    editor.view.dispatch(tr)

    endReview(editor)
  }

  /**
   * Reject all pending changes.
   */
  function rejectAll(editor: Editor) {
    editor.view.dispatch(editor.state.tr.setMeta(diffReviewKey, { type: 'reject-all' }))
    endReview(editor)
  }

  /**
   * End review mode and restore editing.
   */
  function endReview(editor: Editor) {
    editor.view.dispatch(editor.state.tr.setMeta(diffReviewKey, { type: 'end-review' }))
    editor.setEditable(true)
    proposedText.value = ''
  }

  /**
   * Check if all changes are resolved; if so, end review.
   */
  function checkEndReview(editor: Editor) {
    const state = diffReviewKey.getState(editor.state)
    if (!state) return

    const allResolved = state.changeGroups.every(
      (g) => state.acceptedGroupIds.has(g.id) || state.rejectedGroupIds.has(g.id)
    )

    if (allResolved) {
      endReview(editor)
    }
  }

  /**
   * Send an AI editing command via the chat streaming API.
   */
  async function sendEditCommand(
    editor: Editor,
    command: string,
    options: {
      model?: string
      scriptContent?: string
      scriptTitle?: string
      quickCommand?: string
    } = {}
  ) {
    if (isStreaming.value) return

    // Ensure we have an active conversation
    if (!chatStore.activeConversationId) {
      await chatStore.createNewConversation()
    }

    const convId = chatStore.activeConversationId
    if (!convId) return

    isStreaming.value = true

    await startStream(
      convId,
      {
        content: command,
        scriptContent: options.scriptContent ?? editor.getText(),
        scriptTitle: options.scriptTitle,
        quickCommand: options.quickCommand,
        model: options.model
      },
      {
        onToken: (_token: string) => {
          // Tokens are not shown in editor; we wait for the final suggestion
        },
        onDone: (_fullContent: string, metadata?: Record<string, unknown>) => {
          isStreaming.value = false
          const suggestedEdit = metadata?.suggestedEdit as
            | { type: string; content: string; description: string }
            | undefined

          if (suggestedEdit?.content) {
            startReview(editor, suggestedEdit.content)
          }
        },
        onError: (error: Error) => {
          console.error('AI edit stream error:', error)
          isStreaming.value = false
        }
      }
    )
  }

  function abort() {
    abortStream()
    isStreaming.value = false
  }

  return {
    isStreaming: computed(() => isStreaming.value),
    startReview,
    acceptGroup,
    rejectGroup,
    acceptAll,
    rejectAll,
    endReview,
    sendEditCommand,
    abort
  }
}
