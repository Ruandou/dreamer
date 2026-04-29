<script setup lang="ts">
import { watch, computed, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { Extension } from '@tiptap/core'
import { createDiffReviewPlugin } from '@/lib/diff-review/diff-review-plugin'
import { scriptFormatExtensions } from '@/lib/editor/script-format-extension'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    editable?: boolean
    placeholder?: string
    isReviewing?: boolean
  }>(),
  {
    modelValue: '',
    editable: true,
    placeholder: '开始编写剧本...',
    isReviewing: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'selection-change': [selection: { from: number; to: number; text: string } | null]
}>()

const DiffReviewExtension = Extension.create({
  name: 'diffReview',
  addProseMirrorPlugins() {
    return [createDiffReviewPlugin()]
  }
})

const editor = useEditor({
  content: props.modelValue,
  editable: props.editable && !props.isReviewing,
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph']
    }),
    Link.configure({
      openOnClick: false
    }),
    Placeholder.configure({
      placeholder: props.placeholder
    }),
    DiffReviewExtension,
    ...scriptFormatExtensions,
    TaskList,
    TaskItem.configure({
      nested: true
    }),
    Highlight.configure({
      multicolor: true
    })
  ],
  onUpdate: ({ editor }) => {
    if (!props.isReviewing) {
      emit('update:modelValue', editor.getText())
    }
  },
  onSelectionUpdate: ({ editor }) => {
    const { from, to, empty } = editor.state.selection
    if (empty) {
      emit('selection-change', null)
    } else {
      emit('selection-change', {
        from,
        to,
        text: editor.state.doc.textBetween(from, to)
      })
    }
  }
})

// Expose editor instance to parent
defineExpose({
  editor: computed(() => editor.value)
})

// Sync external modelValue changes
watch(
  () => props.modelValue,
  (val) => {
    if (!editor.value || props.isReviewing) return
    const current = editor.value.getText()
    if (val !== current) {
      editor.value.commands.setContent(val, { emitUpdate: false })
    }
  }
)

// Sync editable state
watch(
  () => props.editable && !props.isReviewing,
  (val) => {
    editor.value?.setEditable(val)
  }
)

// Sync review mode
watch(
  () => props.isReviewing,
  (val) => {
    editor.value?.setEditable(!val && props.editable)
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="tiptap-editor" :class="{ 'is-reviewing': isReviewing }">
    <EditorContent v-if="editor" :editor="editor" class="editor-content" />
  </div>
</template>

<style scoped>
.tiptap-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-white);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.tiptap-editor:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.tiptap-editor.is-reviewing {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.editor-content {
  flex: 1;
  overflow: auto;
  padding: 24px 32px;
}

.editor-content :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.editor-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: var(--color-text-tertiary);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.editor-content :deep(.ProseMirror p) {
  margin: 0 0 0.75em 0;
}

.editor-content :deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
}

.editor-content :deep(.ProseMirror h1) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 0 0 0.5em 0;
}

.editor-content :deep(.ProseMirror h2) {
  font-size: 1.25em;
  font-weight: 600;
  margin: 0 0 0.5em 0;
}

.editor-content :deep(.ProseMirror h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0 0 0.5em 0;
}

.editor-content :deep(.ProseMirror ul),
.editor-content :deep(.ProseMirror ol) {
  padding-left: 1.5em;
  margin: 0 0 0.75em 0;
}

.editor-content :deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--color-border);
  padding-left: 1em;
  margin: 0 0 0.75em 0;
  color: var(--color-text-secondary);
}

.editor-content :deep(.ProseMirror pre) {
  background: var(--color-bg-gray);
  padding: 0.75em 1em;
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
  margin: 0 0 0.75em 0;
}

.editor-content :deep(.ProseMirror code) {
  background: var(--color-bg-gray);
  padding: 0.15em 0.35em;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

/* Text align styles */
.editor-content :deep(.ProseMirror p.text-left),
.editor-content :deep(.ProseMirror h1.text-left),
.editor-content :deep(.ProseMirror h2.text-left),
.editor-content :deep(.ProseMirror h3.text-left) {
  text-align: left;
}

.editor-content :deep(.ProseMirror p.text-center),
.editor-content :deep(.ProseMirror h1.text-center),
.editor-content :deep(.ProseMirror h2.text-center),
.editor-content :deep(.ProseMirror h3.text-center) {
  text-align: center;
}

.editor-content :deep(.ProseMirror p.text-right),
.editor-content :deep(.ProseMirror h1.text-right),
.editor-content :deep(.ProseMirror h2.text-right),
.editor-content :deep(.ProseMirror h3.text-right) {
  text-align: right;
}

.editor-content :deep(.ProseMirror p.text-justify),
.editor-content :deep(.ProseMirror h1.text-justify),
.editor-content :deep(.ProseMirror h2.text-justify),
.editor-content :deep(.ProseMirror h3.text-justify) {
  text-align: justify;
}

/* Link styles */
.editor-content :deep(.ProseMirror a) {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.editor-content :deep(.ProseMirror a:hover) {
  color: var(--color-primary-hover);
}

/* Underline */
.editor-content :deep(.ProseMirror u) {
  text-decoration: underline;
}

/* ─── Script Format Nodes ─── */

/* Scene Header: 内景/外景 · 地点 · 时间 */
.editor-content :deep(.ProseMirror p[data-scene-header]) {
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  margin: 1.25em 0 0.75em 0;
  border-left: 3px solid var(--color-primary);
}

/* Character Name */
.editor-content :deep(.ProseMirror p[data-character-name]) {
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
  margin: 1em 0 0.25em 0;
  font-size: 0.95em;
  text-transform: uppercase;
}

/* Dialogue */
.editor-content :deep(.ProseMirror p[data-dialogue]) {
  color: var(--color-text-primary);
  margin: 0 2em 0.75em 2em;
  line-height: 1.8;
}

/* Parenthetical: (情绪/动作提示) */
.editor-content :deep(.ProseMirror p[data-parenthetical]) {
  color: var(--color-text-secondary);
  font-style: italic;
  margin: 0 2.5em 0.25em 2.5em;
  font-size: 0.9em;
}

/* Action/Description */
.editor-content :deep(.ProseMirror p[data-action]) {
  color: var(--color-text-primary);
  margin: 0.75em 0;
  line-height: 1.7;
}

/* Transition: 切至/淡入/淡出 */
.editor-content :deep(.ProseMirror p[data-transition]) {
  font-weight: 600;
  color: var(--color-text-secondary);
  text-align: right;
  margin: 1em 0;
  font-size: 0.9em;
  text-transform: uppercase;
}
</style>
