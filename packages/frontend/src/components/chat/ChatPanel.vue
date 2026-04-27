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
              <span class="tab-title" :title="conv.title">{{ conv.title }}</span>
              <span
                v-if="chatStore.conversations.length > 1"
                class="tab-close"
                title="关闭对话"
                @click.stop="handleDeleteConversation(conv.id)"
              >
                <NIcon :component="CloseOutline" :size="12" />
              </span>
            </div>
          </NTab>
        </NTabs>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton text size="small" class="new-conv-btn" @click="handleNewConversation">
              <template #icon>
                <NIcon :component="AddOutline" :size="16" />
              </template>
            </NButton>
          </template>
          新对话
        </NTooltip>
      </div>

      <!-- Messages -->
      <ChatMessageList
        :messages="chatStore.displayMessages"
        :streaming-message-id="chatStore.streamingMessageId"
        :show-typing="chatStore.isStreaming && !chatStore.streamingContent"
        :is-loading="chatStore.isLoadingMessages"
        @apply-changes="handleApplyChanges"
      />

      <!-- Quick Commands -->
      <QuickCommandBar :disabled="chatStore.isStreaming" @command="handleQuickCommand" />

      <!-- Input -->
      <ChatInput
        :is-streaming="chatStore.isStreaming"
        :reference="reference"
        @send="handleSend"
        @abort="chatStore.abortCurrentStream"
        @clear-reference="emit('clear-reference')"
      >
        <template #actions>
          <NSelect
            v-model:value="selectedModel"
            :options="modelOptions"
            size="tiny"
            placeholder="选择模型"
            class="inline-model-select"
          />
        </template>
      </ChatInput>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { NButton, NTabs, NTab, NIcon, NTooltip, useDialog, NSelect } from 'naive-ui'
import { AddOutline, CloseOutline } from '@vicons/ionicons5'
import { useChatStore } from '../../stores/chat'
import { useModelPreferenceStore } from '../../stores/model-preference'
import type { ChatMessage } from '@dreamer/shared/types'
import ChatMessageList from './ChatMessageList.vue'
import QuickCommandBar from './QuickCommandBar.vue'
import ChatInput from './ChatInput.vue'

const props = defineProps<{
  scriptId?: string
  scriptContent?: string
  scriptTitle?: string
  reference?: { text: string; startLine: number; endLine: number } | null
}>()

const emit = defineEmits<{
  (e: 'apply-changes', content: string): void
  (e: 'clear-reference'): void
}>()

const chatStore = useChatStore()
const modelStore = useModelPreferenceStore()
const dialog = useDialog()

const modelOptions = computed(() =>
  modelStore.textModels.map((m) => ({ label: m.name, value: m.id }))
)

const selectedModel = computed<string | undefined>({
  get: () => modelStore.currentTextModel || modelStore.defaultTextModel,
  set: (val: string | undefined) => {
    modelStore.currentTextModel = val
  }
})

onMounted(async () => {
  await modelStore.init()
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

  const conv = chatStore.conversations.find((c) => c.id === id)
  const hasMessages = chatStore.messages.get(id)?.length ?? 0

  if (hasMessages > 0) {
    dialog.warning({
      title: '确认删除对话',
      content: `确定要删除「${conv?.title || '该对话'}」吗？此操作不可撤销。`,
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: async () => {
        await chatStore.deleteConversation(id)
      }
    })
  } else {
    await chatStore.deleteConversation(id)
  }
}

function handleSend(content: string) {
  let messageContent = content
  if (props.reference) {
    messageContent =
      `引用的内容 (L${props.reference.startLine}-L${props.reference.endLine}):\n\n` +
      `\`\`\`\n${props.reference.text}\n\`\`\`\n\n` +
      `请针对以上引用部分进行修改：\n${messageContent}`
    emit('clear-reference')
  }
  chatStore.sendMessage(messageContent, {
    scriptContent: props.scriptContent,
    scriptTitle: props.scriptTitle,
    model: selectedModel.value
  })
}

function handleQuickCommand(commandId: string) {
  if (props.reference) {
    // Include reference when using quick commands too
    const msg =
      `引用的内容 (L${props.reference.startLine}-L${props.reference.endLine}):\n\n` +
      `\`\`\`\n${props.reference.text}\n\`\`\`\n\n` +
      `请针对以上引用部分进行操作`
    chatStore.sendMessage(msg, {
      scriptContent: props.scriptContent,
      scriptTitle: props.scriptTitle,
      quickCommand: commandId,
      model: selectedModel.value
    })
    emit('clear-reference')
    return
  }
  chatStore.sendMessage('', {
    scriptContent: props.scriptContent,
    scriptTitle: props.scriptTitle,
    quickCommand: commandId,
    model: selectedModel.value
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

.conversation-tabs :deep(.n-tabs-tab) {
  padding: 6px 10px;
}

.new-conv-btn {
  flex-shrink: 0;
  padding: 0 6px;
  height: 28px;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-title {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary, #9ca3af);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  opacity: 0.7;
}

.tab-close:hover {
  color: var(--color-error, #ef4444);
  background: var(--color-error-light, #fee2e2);
  opacity: 1;
}

.inline-model-select {
  width: 120px;
}

.inline-model-select :deep(.n-base-selection) {
  background: transparent;
}
</style>
