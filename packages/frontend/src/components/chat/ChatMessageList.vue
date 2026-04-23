<template>
  <NScrollbar ref="scrollbarRef" class="chat-message-list">
    <div class="messages-container" ref="messagesRef">
      <!-- Empty State -->
      <div v-if="messages.length === 0 && !isLoading && !showTyping" class="chat-empty-state">
        <div class="chat-empty-icon">
          <NIcon :component="ChatbubblesOutline" :size="48" />
        </div>
        <h3 class="chat-empty-title">开始对话</h3>
        <p class="chat-empty-desc">
          在下方输入框中描述你的剧本需求，<br />AI 编剧助手将为你提供创作建议
        </p>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="chat-loading-state">
        <NSpin size="medium" />
        <p class="chat-loading-text">加载消息中...</p>
      </div>

      <!-- Messages -->
      <template v-else>
        <ChatMessageBubble
          v-for="msg in messages"
          :key="msg.id"
          :message="msg"
          :is-streaming="msg.id === streamingMessageId"
          @apply-changes="onApplyChanges(msg)"
        />

        <div v-if="showTyping" class="typing-wrapper">
          <TypingIndicator />
        </div>
      </template>
    </div>
  </NScrollbar>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { NScrollbar, NSpin, NIcon } from 'naive-ui'
import { ChatbubblesOutline } from '@vicons/ionicons5'
import type { ChatMessage } from '@dreamer/shared/types'
import ChatMessageBubble from './ChatMessageBubble.vue'
import TypingIndicator from './TypingIndicator.vue'

const props = defineProps<{
  messages: ChatMessage[]
  streamingMessageId: string | null
  showTyping: boolean
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'apply-changes', message: ChatMessage): void
}>()

const messagesRef = ref<HTMLDivElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    const container = messagesRef.value?.parentElement
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

// Auto-scroll when messages change
watch(
  () => props.messages.length,
  () => scrollToBottom()
)

// Auto-scroll when streaming content updates
watch(
  () => props.messages[props.messages.length - 1]?.id,
  () => scrollToBottom()
)

function onApplyChanges(message: ChatMessage) {
  emit('apply-changes', message)
}
</script>

<style scoped>
.chat-message-list {
  flex: 1;
  overflow: hidden;
}

.messages-container {
  padding: 16px;
  min-height: 100%;
}

.chat-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  text-align: center;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-xl);
  background: var(--color-primary-light);
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
}

.chat-empty-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-xs);
}

.chat-empty-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  margin: 0;
}

.chat-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  gap: var(--spacing-md);
}

.chat-loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.typing-wrapper {
  display: flex;
  padding-left: 34px;
}
</style>
