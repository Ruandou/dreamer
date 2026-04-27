import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatConversation, ChatMessage } from '@dreamer/shared/types'
import {
  getConversations,
  createConversation,
  getConversationWithMessages,
  deleteConversation as deleteConversationApi
} from '../api'
import { useChatStream } from '../composables/useChatStream'

/** Strip [EDIT_SUGGESTION] JSON blocks from message content */
export function sanitizeContent(content: string): string {
  // Strip [EDIT_SUGGESTION]...[/EDIT_SUGGESTION] blocks (either closing form)
  return content.replace(/\[EDIT_SUGGESTION\][\s\S]*?\[\/?EDIT_SUGGESTION\]/g, '').trim()
}

// Quick command labels
const QUICK_COMMAND_LABELS: Record<string, string> = {
  continue: '续写',
  polish: '润色',
  expand: '扩写',
  shorten: '缩写'
}

function getQuickCommandLabel(commandId?: string): string {
  if (!commandId) return ''
  return QUICK_COMMAND_LABELS[commandId] || commandId
}

export const useChatStore = defineStore('chat', () => {
  // State
  const conversations = ref<ChatConversation[]>([])
  const activeConversationId = ref<string | null>(null)
  const messages = ref<Map<string, ChatMessage[]>>(new Map())
  const streamingContent = ref('')
  const streamingMessageId = ref<string | null>(null)
  const isStreaming = ref(false)
  const isLoadingConversations = ref(false)
  const isLoadingMessages = ref(false)

  const { start: startStream, abort: abortStream } = useChatStream()

  // Getters
  const activeConversation = computed(
    () => conversations.value.find((c) => c.id === activeConversationId.value) || null
  )

  const activeMessages = computed(() => {
    if (!activeConversationId.value) return []
    return messages.value.get(activeConversationId.value) || []
  })

  const displayMessages = computed(() => {
    const msgs = [...activeMessages.value]
    if (streamingMessageId.value && streamingContent.value) {
      // Append streaming message
      msgs.push({
        id: streamingMessageId.value,
        conversationId: activeConversationId.value || '',
        role: 'assistant',
        content: sanitizeContent(streamingContent.value),
        status: 'streaming',
        createdAt: new Date().toISOString()
      })
    }
    return msgs
  })

  const hasConversations = computed(() => conversations.value.length > 0)

  const sortedConversations = computed(() =>
    [...conversations.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  )

  // Actions
  async function fetchConversations(scriptId?: string) {
    isLoadingConversations.value = true
    try {
      const result = await getConversations(scriptId)
      conversations.value = result.items
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      isLoadingConversations.value = false
    }
  }

  async function createNewConversation(scriptId?: string, title?: string) {
    try {
      const conversation = await createConversation({ scriptId, title })
      conversations.value.unshift(conversation)
      activeConversationId.value = conversation.id
      messages.value.set(conversation.id, [])
      return conversation
    } catch (error) {
      console.error('Failed to create conversation:', error)
      return null
    }
  }

  async function selectConversation(conversationId: string) {
    activeConversationId.value = conversationId

    // Load messages if not cached
    if (!messages.value.has(conversationId)) {
      await fetchMessages(conversationId)
    }
  }

  async function fetchMessages(conversationId: string) {
    isLoadingMessages.value = true
    try {
      const result = await getConversationWithMessages(conversationId)
      messages.value.set(conversationId, result.messages)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      isLoadingMessages.value = false
    }
  }

  async function deleteConversationItem(conversationId: string) {
    try {
      await deleteConversationApi(conversationId)
      conversations.value = conversations.value.filter((c) => c.id !== conversationId)
      messages.value.delete(conversationId)

      // If active was deleted, switch to first available
      if (activeConversationId.value === conversationId) {
        activeConversationId.value = conversations.value[0]?.id || null
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  async function sendMessage(
    content: string,
    options: {
      scriptContent?: string
      scriptTitle?: string
      quickCommand?: string
      model?: string
    } = {}
  ) {
    if (!activeConversationId.value || isStreaming.value) return

    const convId = activeConversationId.value

    // Generate display content for quick commands
    const displayContent = content || getQuickCommandLabel(options.quickCommand)

    // Optimistic: add user message immediately
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: displayContent,
      status: 'completed',
      createdAt: new Date().toISOString()
    }

    const currentMessages = messages.value.get(convId) || []
    messages.value.set(convId, [...currentMessages, userMsg])

    // Clear streaming state and create streaming placeholder ID
    streamingContent.value = ''
    streamingMessageId.value = `streaming-${Date.now()}`

    // Start streaming
    isStreaming.value = true

    await startStream(
      convId,
      {
        content,
        scriptContent: options.scriptContent,
        scriptTitle: options.scriptTitle,
        quickCommand: options.quickCommand,
        model: options.model
      },
      {
        onToken: (token: string) => {
          streamingContent.value += token
        },
        onDone: (fullContent: string, metadata?: Record<string, unknown>) => {
          // Add the finalized assistant message
          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            conversationId: convId,
            role: 'assistant',
            content: sanitizeContent(fullContent),
            status: 'completed',
            metadata: metadata as ChatMessage['metadata'],
            createdAt: new Date().toISOString()
          }

          const msgs = messages.value.get(convId) || []
          messages.value.set(convId, [...msgs, assistantMsg])

          // Update conversation's updatedAt
          const conv = conversations.value.find((c) => c.id === convId)
          if (conv) {
            conv.updatedAt = new Date().toISOString()
          }

          streamingContent.value = ''
          streamingMessageId.value = null
          isStreaming.value = false
        },
        onError: (error: Error) => {
          console.error('Stream error:', error)
          isStreaming.value = false
          streamingContent.value = ''
          streamingMessageId.value = null
        }
      }
    )
  }

  function abortCurrentStream() {
    abortStream()
    isStreaming.value = false
    streamingContent.value = ''
    streamingMessageId.value = null
  }

  function clearStore() {
    conversations.value = []
    activeConversationId.value = null
    messages.value.clear()
    streamingContent.value = ''
    streamingMessageId.value = null
    isStreaming.value = false
  }

  return {
    // State
    conversations,
    activeConversationId,
    messages,
    streamingContent,
    streamingMessageId,
    isStreaming,
    isLoadingConversations,
    isLoadingMessages,
    // Getters
    activeConversation,
    activeMessages,
    displayMessages,
    hasConversations,
    sortedConversations,
    // Actions
    fetchConversations,
    createNewConversation,
    selectConversation,
    fetchMessages,
    deleteConversation: deleteConversationItem,
    sendMessage,
    abortCurrentStream,
    clearStore
  }
})
