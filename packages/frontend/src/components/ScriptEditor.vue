<template>
  <div class="script-editor-wrapper" :class="{ 'has-diff': hasPendingDiff }">
    <div ref="editorRef" class="codemirror-editor" />
    <!-- Diff Overlay -->
    <div v-if="hasPendingDiff" class="diff-overlay">
      <div class="diff-header">
        <span class="diff-title">AI 修改建议</span>
        <span class="diff-stats">
          <span class="stat-added">+{{ diffStats.additions }}</span>
          <span class="stat-removed">-{{ diffStats.deletions }}</span>
        </span>
      </div>
      <div ref="diffViewRef" class="diff-content" />
      <div class="diff-actions">
        <NButton size="small" secondary @click="$emit('reject-diff')"
          ><template #icon><NIcon :component="CloseOutline" :size="14" /></template>拒绝</NButton
        >
        <NButton size="small" type="primary" @click="$emit('accept-diff')"
          ><template #icon><NIcon :component="CheckmarkOutline" :size="14" /></template
          >接受修改</NButton
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { CloseOutline, CheckmarkOutline } from '@vicons/ionicons5'
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { computeDiff, getDiffStats } from '../composables/useDiff'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  isDropTarget?: boolean
  pendingEditContent?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input'): void
  (e: 'drop', event: DragEvent): void
  (e: 'dragover', event: DragEvent): void
  (e: 'dragleave', event: DragEvent): void
  (e: 'accept-diff'): void
  (e: 'reject-diff'): void
}>()

const editorRef = ref<HTMLDivElement>()
const diffViewRef = ref<HTMLDivElement>()
let view: EditorView | null = null

const hasPendingDiff = computed(() => !!props.pendingEditContent)

const diffStats = computed(() => {
  if (!props.pendingEditContent) return { additions: 0, deletions: 0 }
  const lines = computeDiff(props.modelValue, props.pendingEditContent)
  return getDiffStats(lines)
})

// Custom theme matching existing textarea style
const customTheme = EditorView.theme({
  '&': {
    fontSize: '15px',
    lineHeight: '1.7',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Menlo', monospace",
    backgroundColor: 'var(--color-bg-white, #fff)',
    color: 'var(--color-text-primary, #1f2937)'
  },
  '.cm-content': {
    padding: '16px',
    caretColor: 'var(--color-primary, #6366f1)'
  },
  '.cm-gutters': {
    display: 'none'
  },
  '.cm-line': {
    padding: '0'
  },
  '.cm-focused': {
    outline: 'none'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-primary, #6366f1)',
    borderLeftWidth: '2px'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(99, 102, 241, 0.15) !important'
  },
  '&.cm-editor': {
    borderRadius: '10px',
    border: '1px solid var(--color-border, #e5e7eb)'
  },
  '&.cm-editor.cm-focused': {
    borderColor: 'var(--color-primary, #6366f1)',
    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
  }
})

function createState(content: string): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [
      customTheme,
      history(),
      keymap.of(defaultKeymap),
      keymap.of(historyKeymap),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString()
          if (newValue !== props.modelValue) {
            emit('update:modelValue', newValue)
            emit('input')
          }
        }
      }),
      EditorView.domEventHandlers({
        drop(event) {
          const text = event.dataTransfer?.getData('text/plain')
          if (text && view) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos != null) {
              view.dispatch({
                changes: { from: pos, to: pos, insert: text },
                selection: { anchor: pos + text.length }
              })
              emit('input')
            }
          }
          emit('drop', event)
        },
        dragover(event) {
          emit('dragover', event)
        },
        dragleave(event) {
          emit('dragleave', event)
        }
      })
    ]
  })
}

onMounted(() => {
  if (!editorRef.value) return

  view = new EditorView({
    state: createState(props.modelValue),
    parent: editorRef.value
  })

  // Disable native spellcheck to match textarea
  view.contentDOM.setAttribute('spellcheck', 'false')
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})

// Sync external modelValue changes (e.g. accept diff, switch episode)
watch(
  () => props.modelValue,
  (newValue) => {
    if (view && newValue !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newValue
        }
      })
    }
  },
  { immediate: true }
)

// Expose methods for parent component
defineExpose({
  focus() {
    view?.focus()
  },
  getSelection(): { from: number; to: number } | null {
    if (!view) return null
    const sel = view.state.selection.main
    return { from: sel.from, to: sel.to }
  },
  setSelection(anchor: number, head?: number) {
    if (!view) return
    view.dispatch({
      selection: { anchor, head: head ?? anchor }
    })
    view.focus()
  },
  insertText(text: string) {
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length }
    })
    view.focus()
    emit('input')
  },
  getContent(): string {
    return view?.state.doc.toString() ?? ''
  }
})

// Render diff preview when pendingEditContent changes
watch(
  () => props.pendingEditContent,
  (newContent) => {
    nextTick(() => {
      if (!diffViewRef.value || !newContent) return
      const diffLines = computeDiff(props.modelValue, newContent)
      diffViewRef.value.innerHTML = ''
      diffLines.forEach((line) => {
        const div = document.createElement('div')
        div.className = `diff-row diff-row--${line.type}`
        div.innerHTML = `<span class="diff-sign">${line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span><span class="diff-text">${escapeHtml(line.content || ' ')}</span>`
        diffViewRef.value!.appendChild(div)
      })
    })
  },
  { immediate: true }
)

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
</script>

<style scoped>
.script-editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  min-width: 0;
  width: 100%;
}

.codemirror-editor {
  flex: 1;
  overflow: hidden;
  border-radius: 10px;
  width: 100%;
}

.codemirror-editor :deep(.cm-editor) {
  height: 100%;
}

.codemirror-editor :deep(.cm-scroller) {
  overflow: auto;
}

/* Diff Overlay */
.diff-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-bg-white, #fff);
  border: 1px solid var(--color-primary, #6366f1);
  border-radius: 10px 10px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  z-index: 20;
  max-height: 45%;
  display: flex;
  flex-direction: column;
}

.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--color-bg-light, #f0f9ff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}

.diff-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
}

.diff-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
}

.stat-added {
  color: var(--color-success, #16a34a);
}

.stat-removed {
  color: var(--color-error, #dc2626);
}

.diff-content {
  flex: 1;
  overflow: auto;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 20px;
}

.diff-row {
  display: flex;
  align-items: flex-start;
  min-height: 20px;
  border-radius: 2px;
  white-space: pre-wrap;
}

.diff-row--added {
  background: var(--color-success-light, #dcfce7);
}

.diff-row--removed {
  background: var(--color-error-light, #fee2e2);
}

.diff-sign {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
  font-weight: 600;
  user-select: none;
  color: var(--color-text-tertiary, #9ca3af);
}

.diff-row--added .diff-sign {
  color: var(--color-success, #16a34a);
}

.diff-row--removed .diff-sign {
  color: var(--color-error, #dc2626);
}

.diff-text {
  flex: 1;
  word-break: break-all;
}

.diff-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
  background: var(--color-bg-white, #fff);
}

/* Drop target highlight */
.script-editor-wrapper :deep(.cm-editor.drop-active) {
  border-color: var(--color-primary, #6366f1);
  border-style: dashed;
  border-width: 2px;
}
</style>
