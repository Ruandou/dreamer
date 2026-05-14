<template>
  <div class="script-editor-wrapper">
    <!-- Diff Review Toolbar -->
    <div v-if="hasPendingDiff" class="diff-toolbar">
      <div class="diff-toolbar-left">
        <NIcon :component="SparklesOutline" :size="14" class="diff-icon" />
        <span class="diff-label">AI 修改建议</span>
        <span class="diff-stat added">+{{ diffStats.additions }}</span>
        <span class="diff-stat removed">-{{ diffStats.deletions }}</span>
      </div>
      <div class="diff-toolbar-right">
        <NButton size="tiny" secondary @click="$emit('reject-diff')">
          <template #icon><NIcon :component="CloseOutline" :size="12" /></template>
          拒绝
        </NButton>
        <NButton size="tiny" type="primary" @click="$emit('accept-diff')">
          <template #icon><NIcon :component="CheckmarkOutline" :size="12" /></template>
          接受修改
        </NButton>
      </div>
    </div>

    <div ref="editorRef" class="codemirror-editor" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { SparklesOutline, CloseOutline, CheckmarkOutline } from '@vicons/ionicons5'
import { EditorView, keymap, type ViewUpdate, Decoration, WidgetType } from '@codemirror/view'
import { EditorState, StateField, StateEffect, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { diffLines } from 'diff'

const props = defineProps<{
  modelValue: string
  placeholder?: string
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
let view: EditorView | null = null
const diffCompartment = new Compartment()

const hasPendingDiff = computed(
  () => !!props.pendingEditContent && props.pendingEditContent !== props.modelValue
)

const diffStats = computed(() => {
  if (!props.pendingEditContent) return { additions: 0, deletions: 0 }
  const changes = diffLines(props.modelValue, props.pendingEditContent)
  let additions = 0,
    deletions = 0
  for (const ch of changes) {
    const lines = ch.value.endsWith('\n') ? ch.value.slice(0, -1).split('\n') : ch.value.split('\n')
    if (lines.length === 1 && lines[0] === '' && ch.value.endsWith('\n')) {
      if (ch.added) additions++
      else if (ch.removed) deletions++
    } else {
      const count = lines.filter((l) => l !== '' || ch.value.endsWith('\n')).length
      if (ch.added) additions += count
      else if (ch.removed) deletions += count
    }
  }
  return { additions, deletions }
})

// --- Diff Decoration Effects ---
const setDiffDecorations = StateEffect.define<DecorationSet>()

const diffField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setDiffDecorations)) decorations = e.value
    }
    return decorations
  },
  provide: (f) => EditorView.decorations.from(f)
})

class AddedLineWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }
  eq(other: AddedLineWidget) {
    return this.text === other.text
  }
  toDOM() {
    const div = document.createElement('div')
    div.className = 'cm-diff-added-line'
    div.textContent = this.text || ' '
    return div
  }
  ignoreEvent() {
    return false
  }
}

// Build diff decorations
function buildDiffDecorations(
  original: string,
  revised: string,
  editorView: EditorView
): DecorationSet {
  const changes = diffLines(original, revised)
  const decorations: Decoration[] = []
  let origLine = 1

  for (const change of changes) {
    const raw = change.value
    const clean = raw.endsWith('\n') ? raw.slice(0, -1) : raw
    const lines = clean === '' ? (raw.endsWith('\n') ? [''] : []) : clean.split('\n')

    if (change.removed) {
      for (let i = 0; i < lines.length; i++) {
        if (origLine <= editorView.state.doc.lines) {
          const line = editorView.state.doc.line(origLine)
          decorations.push(
            Decoration.mark({
              attributes: { class: 'cm-diff-removed' }
            }).range(line.from, line.to)
          )
        }
        origLine++
      }
    } else if (change.added) {
      for (let i = 0; i < lines.length; i++) {
        const pos =
          origLine <= editorView.state.doc.lines
            ? editorView.state.doc.line(origLine).from
            : editorView.state.doc.length
        decorations.push(
          Decoration.widget({
            widget: new AddedLineWidget(lines[i]),
            side: -1,
            block: true
          }).range(pos)
        )
      }
    } else {
      origLine += lines.length || (raw.endsWith('\n') ? 1 : 0)
    }
  }

  return Decoration.set(decorations)
}

// Custom theme
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
  '.cm-gutters': { display: 'none' },
  '.cm-line': { padding: '0' },
  '.cm-focused': { outline: 'none' },
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
  },
  // Diff styles
  '.cm-diff-removed': {
    backgroundColor: 'var(--color-error-light, #fee2e2) !important',
    textDecoration: 'line-through',
    opacity: '0.6'
  },
  '.cm-diff-added-line': {
    backgroundColor: 'var(--color-success-light, #dcfce7)',
    padding: '0 16px',
    color: 'var(--color-success, #16a34a)',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '15px',
    lineHeight: '1.7',
    borderLeft: '3px solid var(--color-success, #16a34a)',
    marginLeft: '-3px'
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
      diffCompartment.of(diffField.init(() => Decoration.none)),
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
  view.contentDOM.setAttribute('spellcheck', 'false')
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})

// Sync external modelValue changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (view && newValue !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newValue }
      })
    }
  },
  { immediate: true }
)

// Apply diff decorations when pendingEditContent changes
watch(
  () => props.pendingEditContent,
  (newContent) => {
    if (!view) return
    if (!newContent || newContent === props.modelValue) {
      view.dispatch({ effects: setDiffDecorations.of(Decoration.none) })
    } else {
      const decos = buildDiffDecorations(props.modelValue, newContent, view)
      view.dispatch({ effects: setDiffDecorations.of(decos) })
    }
  },
  { immediate: true }
)

defineExpose({
  focus() {
    view?.focus()
  },
  getSelection() {
    if (!view) return null
    const sel = view.state.selection.main
    return { from: sel.from, to: sel.to }
  },
  setSelection(anchor: number, head?: number) {
    if (!view) return
    view.dispatch({ selection: { anchor, head: head ?? anchor } })
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
</script>

<style scoped>
.script-editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: hidden;
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

/* Diff Toolbar */
.diff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--color-bg-light, #f0f9ff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  flex-shrink: 0;
  gap: 12px;
}

.diff-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-icon {
  color: var(--color-primary, #6366f1);
}

.diff-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
}

.diff-stat {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.diff-stat.added {
  color: var(--color-success, #16a34a);
  background: var(--color-success-light, #dcfce7);
}

.diff-stat.removed {
  color: var(--color-error, #dc2626);
  background: var(--color-error-light, #fee2e2);
}

.diff-toolbar-right {
  display: flex;
  gap: 8px;
}
</style>
