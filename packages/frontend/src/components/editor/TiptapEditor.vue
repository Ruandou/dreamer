<script setup lang="ts">
import { watch, computed, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { createDiffReviewPlugin } from '@/lib/diff-review/diff-review-plugin'

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
    Placeholder.configure({
      placeholder: props.placeholder
    }),
    DiffReviewExtension
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
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
  padding: 16px;
}

.editor-content :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  font-size: 14px;
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
</style>
