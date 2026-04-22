<template>
  <div class="chat-panel">
    <!-- Conversation Sidebar (collapsible) -->
    <ConversationSidebar
      v-if="showSidebar"
      :conversations="chatStore.sortedConversations"
      :active-id="chatStore.activeConversationId"
      @new="handleNewConversation"
      @select="handleSelectConversation"
      @delete="handleDeleteConversation"
    />

    <!-- Main Chat Area -->
    <div class="chat-main">
      <!-- Toggle sidebar button -->
      <div class="chat-header">
        <NButton text size="small" @click="showSidebar = !showSidebar">
          {{ showSidebar ? '隐藏' : '显示' }}对话列表
        </NButton>
        <span v-if="chatStore.activeConversation" class="chat-title">
          {{ chatStore.activeConversation.title }}
        </span>
      </div>

      <!-- Messages -->
      <ChatMessageList
        :messages="chatStore.displayMessages"
        :streaming-message-id="chatStore.streamingMessageId"
        :show-typing="chatStore.isStreaming && !chatStore.streamingContent"
        @apply-changes="handleApplyChanges"
      />

      <!-- Quick Commands -->
      <QuickCommandBar :disabled="chatStore.isStreaming" @command="handleQuickCommand" />

      <!-- Input -->
      <ChatInput
        :is-streaming="chatStore.isStreaming"
        @send="handleSend"
        @abort="chatStore.abortCurrentStream"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { NButton } from 'naive-ui'
import { useChatStore } from '../../stores/chat'
import type { ChatMessage } from '@dreamer/shared/types'
import ConversationSidebar from './ConversationSidebar.vue'
import ChatMessageList from './ChatMessageList.vue'
import QuickCommandBar from './QuickCommandBar.vue'
import ChatInput from './ChatInput.vue'

const props = defineProps<{
  scriptId?: string
  scriptContent?: string
  scriptTitle?: string
}>()

const emit = defineEmits<{
  (e: 'apply-changes', content: string): void
}>()

const chatStore = useChatStore()
const showSidebar = ref(true)

onMounted(async () => {
  await chatStore.fetchConversations(props.scriptId)

  // Auto-create if no conversations
  if (chatStore.conversations.length === 0) {
    await chatStore.createNewConversation(props.scriptId)
  } else if (!chatStore.activeConversationId) {
    chatStore.selectConversation(chatStore.conversations[0].id)
  }
})

// Reload messages when switching conversations
watch(
  () => chatStore.activeConversationId,
  (id) => {
    if (id) {
      chatStore.selectConversation(id)
    }
  }
)

async function handleNewConversation() {
  await chatStore.createNewConversation(props.scriptId)
}

function handleSelectConversation(id: string) {
  chatStore.selectConversation(id)
}

async function handleDeleteConversation(id: string) {
  await chatStore.deleteConversation(id)
}

function handleSend(content: string) {
  chatStore.sendMessage(content, {
    scriptContent: props.scriptContent,
    scriptTitle: props.scriptTitle
  })
}

function handleQuickCommand(commandId: string) {
  chatStore.sendMessage('', {
    scriptContent: props.scriptContent,
    scriptTitle: props.scriptTitle,
    quickCommand: commandId
  })
}

function handleApplyChanges(message: ChatMessage) {
  const suggestedEdit = message.metadata?.suggestedEdit
  if (suggestedEdit?.content) {
    emit('apply-changes', suggestedEdit.content)
  }
}
</script>

<style scoped>
.chat-panel {
  display: flex;
  height: 100%;
  background: var(--color-bg-white, #fff);
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
}

.chat-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}
</style>
