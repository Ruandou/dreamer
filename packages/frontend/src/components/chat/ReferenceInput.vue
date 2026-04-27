<template>
  <div
    ref="editorRef"
    :contenteditable="!disabled"
    class="reference-input"
    :class="{ 'is-focused': focused, 'is-disabled': disabled }"
    :data-placeholder="placeholder"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="onKeydown"
    @input="onInput"
  >
    <!-- Chip injected by watch, could also use v-html but DOM is simpler -->
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
  reference?: { text: string; startLine: number; endLine: number } | null
  /** Which modifier is required with Enter to send. 'none' = plain Enter, 'ctrl' = Ctrl+Enter */
  sendModifier?: 'none' | 'ctrl'
}>()

const emit = defineEmits<{
  (e: 'send', text: string): void
  (e: 'clear-reference'): void
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const focused = ref(false)

// ---- DOM helpers ----

function getUserText(): string {
  const el = editorRef.value
  if (!el) return ''
  // Clone so we don't mutate live DOM
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.ref-chip').forEach((c) => c.remove())
  return clone.innerText?.trim() || ''
}

// ---- Chip management ----

function insertChip(lineRef: { startLine: number; endLine: number }) {
  const el = editorRef.value
  if (!el) return
  // Remove existing chip
  el.querySelectorAll('.ref-chip').forEach((c) => c.remove())

  const chip = document.createElement('span')
  chip.className = 'ref-chip'
  chip.contentEditable = 'false'
  chip.setAttribute('data-start-line', String(lineRef.startLine))
  chip.setAttribute('data-end-line', String(lineRef.endLine))
  chip.innerHTML = `
    <span class="ref-chip__badge">L${lineRef.startLine}-L${lineRef.endLine}</span>
    <span class="ref-chip__remove" data-action="remove-ref">✕</span>
  `
  // Click on ✕ to clear reference
  chip.querySelector('.ref-chip__remove')?.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    emit('clear-reference')
  })

  el.prepend(chip)

  // Ensure there's a text node after so user can type
  if (!el.lastChild || el.lastChild === chip) {
    el.appendChild(document.createTextNode('\u200B')) // zero-width space as cursor anchor
  }
}

function removeChip() {
  editorRef.value?.querySelectorAll('.ref-chip').forEach((c) => c.remove())
}

// Watch reference changes
watch(
  () => props.reference,
  (val) => {
    if (val) {
      insertChip(val)
    } else {
      removeChip()
    }
  },
  { immediate: true }
)

// On mount, if reference already set
onMounted(() => {
  if (props.reference) {
    insertChip(props.reference)
  }
})

// ---- Events ----

function onFocus() {
  focused.value = true
}

function onBlur() {
  focused.value = false
}

function onKeydown(e: KeyboardEvent) {
  const useCtrl = props.sendModifier === 'ctrl'
  if (e.key === 'Enter') {
    if (useCtrl) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        doSend()
      }
    } else if (!e.shiftKey) {
      e.preventDefault()
      doSend()
    }
  }
}

function doSend() {
  const text = getUserText()
  if (text) {
    emit('send', text)
    const el = editorRef.value
    if (el) {
      el.innerText = ''
      el.focus()
    }
  }
}

function onInput() {
  // Ensure chip stays at the beginning (user can't backspace into it)
  const el = editorRef.value
  if (!el) return
  const chip = el.querySelector('.ref-chip')
  if (chip && el.firstChild !== chip) {
    el.prepend(chip)
  }
  // If editor is empty, add a zero-width space for the placeholder to work
  if (!el.textContent?.trim() && !chip) {
    el.innerHTML = '\u200B'
  }
}
</script>

<style scoped>
.reference-input {
  position: relative;
  min-height: 52px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.65;
  font-family: inherit;
  color: var(--color-text-primary, #1e293b);
  outline: none;
  border: none;
  background: transparent;
  word-break: break-word;
  white-space: pre-wrap;
}

.reference-input:empty::before {
  content: attr(data-placeholder);
  color: var(--color-text-tertiary, #9ca3af);
  pointer-events: none;
}

.reference-input.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---- Inline reference chip (matching storyboard mention style) ---- */
.reference-input :deep(.ref-chip) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: baseline;
  padding: 0 6px 0 8px;
  margin-right: 6px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(251, 191, 36, 0.08));
  border: 1px solid rgba(245, 158, 11, 0.35);
  font-weight: 500;
  font-size: 0.92em;
  line-height: 1.4;
  color: var(--color-secondary, #d97706);
  user-select: none;
}

.reference-input :deep(.ref-chip__badge) {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.reference-input :deep(.ref-chip__remove) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  font-size: 9px;
  color: rgba(245, 158, 11, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
}

.reference-input :deep(.ref-chip__remove:hover) {
  color: #d97706;
  background: rgba(245, 158, 11, 0.15);
}
</style>
