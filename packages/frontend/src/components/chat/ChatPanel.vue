<template>
  <div class="chat-panel">
    <!-- Main Chat Area -->
    <div class="chat-main">
      <!-- Conversation Tabs + New button -->
      <div class="chat-tabs-bar">
        <NTabs
          type="card"
          size="small"
          :value="chatStore.activeConversationId || undefined"
          @update:value="handleSelectConversation"
          class="conversation-tabs"
        >
          <NTab v-for="conv in chatStore.sortedConversations" :key="conv.id" :name="conv.id">
            <div class="tab-label">
              <span class="tab-title">{{ conv.title }}</span>
              <span class="tab-close" @click.stop="handleDeleteConversation(conv.id)">×</span>
            </div>
          </NTab>
        </NTabs>
        <NButton text size="small" class="new-conv-btn" @click="handleNewConversation">
          + 新对话
        </NButton>
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
import { onMounted, watch } from 'vue'
import { NButton, NTabs, NTab } from 'naive-ui'
import { useChatStore } from '../../stores/chat'
import type { ChatMessage } from '@dreamer/shared/types'
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
  if (chatStore.conversations.length <= 1) {
    return
  }
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

.chat-tabs-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 0;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
  flex-shrink: 0;
}

.conversation-tabs {
  flex: 1;
  overflow: hidden;
}

.conversation-tabs :deep(.n-tabs-nav) {
  margin-bottom: 0;
}

.new-conv-btn {
  flex-shrink: 0;
  padding: 0 8px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tab-title {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 12px;
  line-height: 1;
  color: var(--color-text-tertiary, #9ca3af);
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.15s;
}

.tab-close:hover {
  color: var(--color-text-primary, #111827);
  background: var(--color-bg-secondary, #f3f4f6);
}
</style>
