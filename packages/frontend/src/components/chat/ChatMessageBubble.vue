<template>
  <div :class="['chat-message', { 'message-user': isUser, 'message-assistant': !isUser }]">
    <div class="message-meta" v-if="!isUser">
      <div class="message-avatar">
        <NIcon :component="VideocamOutline" :size="16" />
      </div>
      <span class="message-sender">AI 编剧助手</span>
      <span v-if="message.createdAt" class="message-time">{{ formatTime(message.createdAt) }}</span>
    </div>
    <div class="message-meta message-meta--user" v-else>
      <span v-if="message.createdAt" class="message-time">{{ formatTime(message.createdAt) }}</span>
      <span class="message-sender">我</span>
      <div class="message-avatar message-avatar--user">
        <NIcon :component="PersonOutline" :size="16" />
      </div>
    </div>

    <div class="message-bubble-wrapper" :class="{ 'message-bubble-wrapper--user': isUser }">
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { VideocamOutline, PersonOutline } from '@vicons/ionicons5'
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

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.chat-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
  animation: fadeInUp 0.25s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.message-meta--user {
  justify-content: flex-end;
}

.message-avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.message-avatar--user {
  background: var(--color-primary);
  color: white;
}

.message-sender {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.message-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.message-bubble-wrapper {
  display: flex;
  padding-left: 34px;
}

.message-bubble-wrapper--user {
  justify-content: flex-end;
  padding-left: 0;
  padding-right: 34px;
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
