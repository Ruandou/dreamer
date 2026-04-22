<template>
  <div :class="['chat-message', { 'message-user': isUser, 'message-assistant': !isUser }]">
    <div class="message-avatar" v-if="!isUser">
      <span class="avatar-icon">🎬</span>
    </div>

    <div class="message-bubble">
      <template v-if="isUser">
        <div class="message-text">{{ message.content }}</div>
      </template>
      <template v-else>
        <MarkdownRenderer :content="message.content" />
        <div v-if="isStreaming" class="streaming-cursor"></div>

        <div v-if="hasSuggestedEdit" class="suggested-edit-actions">
          <ApplyChangesButton @apply="$emit('apply-changes')" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '@dreamer/shared/types'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ApplyChangesButton from './ApplyChangesButton.vue'

const props = defineProps<{
  message: ChatMessage
  isStreaming?: boolean
}>()

defineEmits<{
  'apply-changes': []
}>()

const isUser = computed(() => props.message.role === 'user')

const hasSuggestedEdit = computed(() => {
  return (
    !isUser.value &&
    props.message.metadata?.suggestedEdit !== undefined &&
    props.message.metadata?.suggestedEdit !== null
  )
})
</script>

<style scoped>
.chat-message {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-icon {
  font-size: 18px;
}

.message-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
}

.message-user .message-bubble {
  background: var(--color-primary, #6366f1);
  color: white;
  border-radius: 12px 12px 4px 12px;
}

.message-assistant .message-bubble {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #111827);
  border-radius: 12px 12px 12px 4px;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.streaming-cursor {
  display: inline-block;
  animation: blink-cursor 0.8s step-end infinite;
  color: var(--color-primary, #6366f1);
  font-weight: bold;
}

@keyframes blink-cursor {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.suggested-edit-actions {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
}
</style>
