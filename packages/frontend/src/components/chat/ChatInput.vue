<template>
  <div class="chat-input">
    <ReferenceInput
      ref="inputRef"
      :placeholder="disabled ? 'AI 正在回复...' : placeholder"
      :disabled="disabled"
      :reference="reference"
      @send="onSend"
      @clear-reference="$emit('clear-reference')"
    />
    <div class="input-actions">
      <span class="input-hint">
        <NIcon :component="ReturnDownBackOutline" :size="12" />
        Enter 发送 · Shift+Enter 换行
      </span>
      <div class="input-actions-right">
        <slot name="actions"></slot>
        <NButton
          :type="isStreaming ? 'error' : 'primary'"
          :loading="isStreaming && !disabled"
          :disabled="!hasText && !isStreaming"
          size="small"
          @click="handleManualSend"
        >
          <template #icon>
            <NIcon :component="isStreaming ? StopCircleOutline : SendOutline" :size="16" />
          </template>
          {{ isStreaming ? '停止' : sendLabel }}
        </NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { SendOutline, StopCircleOutline, ReturnDownBackOutline } from '@vicons/ionicons5'
import ReferenceInput from './ReferenceInput.vue'

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
  sendLabel?: string
  isStreaming?: boolean
  reference?: { text: string; startLine: number; endLine: number } | null
}>()

const emit = defineEmits<{
  (e: 'send', content: string): void
  (e: 'abort'): void
  (e: 'clear-reference'): void
}>()

const inputRef = ref<InstanceType<typeof ReferenceInput> | null>(null)
const hasText = ref(false)

function onSend(text: string) {
  hasText.value = false
  emit('send', text)
}

function handleManualSend() {
  if (props.isStreaming) {
    emit('abort')
    return
  }
  // ReferenceInput handles the Enter send itself;
  // this is just for the send button click
  const el = inputRef.value?.$el as HTMLDivElement | null
  if (!el) return
  // Remove ref-chip, get innerText
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.ref-chip').forEach((c) => c.remove())
  const text = clone.innerText?.trim() || ''
  if (!text) return
  onSend(text)
  // Clear the editor
  el.innerText = ''
}
</script>

<style scoped>
.chat-input {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-bg-white, #fff);
}

.chat-input :deep(.reference-input) {
  margin-bottom: 8px;
  border: 2px solid var(--color-border-light, #e5e7eb);
  border-radius: var(--radius-lg);
  background: var(--color-bg-white, #fff);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.chat-input :deep(.reference-input.is-focused) {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  user-select: none;
}

.input-actions-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
