<template>
  <div class="chat-input">
    <NInput
      v-model:value="inputValue"
      type="textarea"
      :placeholder="disabled ? 'AI 正在回复...' : placeholder"
      :disabled="disabled"
      :autosize="{ minRows: 1, maxRows: 6 }"
      @keydown="handleKeyDown"
    />
    <div class="input-actions">
      <NButton
        :type="isStreaming ? 'error' : 'primary'"
        :loading="isStreaming && !disabled"
        :disabled="!inputValue.trim() && !isStreaming"
        @click="handleAction"
      >
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
  padding: 12px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
