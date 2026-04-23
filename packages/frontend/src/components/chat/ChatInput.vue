<template>
  <div class="chat-input">
    <div class="input-wrapper">
      <NInput
        v-model:value="inputValue"
        type="textarea"
        :placeholder="disabled ? 'AI 正在回复...' : placeholder"
        :disabled="disabled"
        :autosize="{ minRows: 2, maxRows: 8 }"
        @keydown="handleKeyDown"
      />
    </div>
    <div class="input-actions">
      <span class="input-hint">
        <NIcon :component="ReturnDownBackOutline" :size="12" />
        Enter 发送 · Shift+Enter 换行
      </span>
      <NButton
        :type="isStreaming ? 'error' : 'primary'"
        :loading="isStreaming && !disabled"
        :disabled="!inputValue.trim() && !isStreaming"
        size="small"
        @click="handleAction"
      >
        <template #icon>
          <NIcon :component="isStreaming ? StopCircleOutline : SendOutline" :size="16" />
        </template>
        {{ isStreaming ? '停止' : sendLabel }}
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NButton, NIcon } from 'naive-ui'
import { SendOutline, StopCircleOutline, ReturnDownBackOutline } from '@vicons/ionicons5'

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
  sendLabel?: string
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  (e: 'send', content: string): void
  (e: 'abort'): void
}>()

const inputValue = ref('')

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleAction()
  }
}

function handleAction() {
  if (props.isStreaming) {
    emit('abort')
    return
  }

  const content = inputValue.value.trim()
  if (!content) return

  emit('send', content)
  inputValue.value = ''
}
</script>

<style scoped>
.chat-input {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-bg-white, #fff);
}

.input-wrapper {
  margin-bottom: 8px;
}

.input-wrapper :deep(.n-input) {
  border-radius: var(--radius-lg);
  border: 2px solid var(--color-border-light, #e5e7eb);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input-wrapper :deep(.n-input:focus-within) {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.input-wrapper :deep(.n-input .n-input-wrapper) {
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
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
</style>
