<template>
  <NScrollbar ref="scrollbarRef" class="chat-message-list">
    <div class="messages-container" ref="messagesRef">
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
    </div>
  </NScrollbar>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { NScrollbar } from 'naive-ui'
import type { ChatMessage } from '@dreamer/shared/types'
import ChatMessageBubble from './ChatMessageBubble.vue'
import TypingIndicator from './TypingIndicator.vue'

const props = defineProps<{
  messages: ChatMessage[]
  streamingMessageId: string | null
  showTyping: boolean
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
  padding: 12px;
}

.typing-wrapper {
  display: flex;
}
</style>
