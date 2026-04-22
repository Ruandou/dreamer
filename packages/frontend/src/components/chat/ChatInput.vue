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
      <NButton
        size="large"
        :type="isStreaming ? 'error' : 'primary'"
        :loading="isStreaming && !disabled"
        :disabled="!inputValue.trim() && !isStreaming"
        @click="handleAction"
      >
        <template #icon>
          <span v-if="!isStreaming">➤</span>
          <span v-else>◼</span>
        </template>
        {{ isStreaming ? '停止' : sendLabel }}
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NButton } from 'naive-ui'

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
  padding: 16px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-bg-white, #fff);
}

.input-wrapper {
  margin-bottom: 12px;
}

.input-wrapper :deep(.n-input) {
  border-radius: 12px;
  border: 2px solid var(--color-border-light, #e5e7eb);
  transition: border-color 0.2s;
}

.input-wrapper :deep(.n-input:focus-within) {
  border-color: var(--color-primary, #6366f1);
}

.input-wrapper :deep(.n-input .n-input-wrapper) {
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.input-actions :deep(.n-button) {
  border-radius: 10px;
  padding: 0 24px;
  height: 44px;
  font-weight: 500;
  font-size: 15px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  transition: all 0.2s;
}

.input-actions :deep(.n-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.input-actions :deep(.n-button:active) {
  transform: translateY(0);
}
</style>
