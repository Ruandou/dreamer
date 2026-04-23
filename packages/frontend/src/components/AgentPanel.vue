<template>
  <div class="agent-panel">
    <!-- Header -->
    <div class="agent-header">
      <div class="agent-title">
        <NIcon :component="ConstructOutline" :size="18" class="agent-icon" />
        <span>AI 编剧 Agent</span>
      </div>
      <div class="header-actions">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton text size="small" @click="showMemories = !showMemories">
              <template #icon>
                <NIcon :component="BookOutline" :size="16" />
              </template>
            </NButton>
          </template>
          查看记忆
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton text size="small" @click="resetSession">
              <template #icon>
                <NIcon :component="RefreshOutline" :size="16" />
              </template>
            </NButton>
          </template>
          重置对话
        </NTooltip>
      </div>
    </div>

    <!-- Memory Viewer -->
    <div v-if="showMemories" class="memory-viewer">
      <div class="memory-header">
        <span class="memory-title">剧本记忆</span>
        <NButton text size="small" @click="loadMemories">
          <template #icon>
            <NIcon :component="RefreshOutline" :size="14" />
          </template>
        </NButton>
      </div>
      <div v-if="memories.length > 0" class="memory-list">
        <div v-for="memory in memories" :key="memory.id" class="memory-item">
          <div class="memory-type">{{ memory.type }}</div>
          <div class="memory-title-text">{{ memory.title }}</div>
          <div class="memory-content">{{ memory.content.substring(0, 100) }}...</div>
        </div>
      </div>
      <div v-else class="no-memories">暂无记忆</div>
    </div>

    <!-- Step Progress -->
    <div class="step-progress">
      <div
        v-for="step in steps"
        :key="step.key"
        class="step-item"
        :class="{
          'step-completed': step.status === 'completed',
          'step-active': step.status === 'active',
          'step-pending': step.status === 'pending'
        }"
      >
        <div class="step-icon">
          <NIcon
            v-if="step.status === 'completed'"
            :component="CheckmarkCircleOutline"
            :size="16"
          />
          <NSpin v-else-if="step.status === 'active'" :size="16" />
          <NIcon v-else :component="EllipsisHorizontalCircleOutline" :size="16" />
        </div>
        <span class="step-label">{{ step.label }}</span>
      </div>
    </div>

    <!-- Messages -->
    <div class="agent-messages" ref="messagesContainer">
      <div
        v-for="(message, index) in messages"
        :key="index"
        class="message-item"
        :class="message.role"
      >
        <div class="message-avatar">
          <NIcon v-if="message.role === 'agent'" :component="ConstructOutline" :size="20" />
          <NIcon v-else :component="PersonOutline" :size="20" />
        </div>
        <div class="message-content">
          <div class="message-text" v-html="formatMessage(message.content)"></div>

          <!-- Action Buttons for Agent Messages -->
          <div v-if="message.actions" class="message-actions">
            <NButton
              v-for="action in message.actions"
              :key="action.type"
              :type="action.primary ? 'primary' : 'default'"
              size="small"
              :disabled="isLoading"
              @click="handleAction(action)"
            >
              {{ action.label }}
            </NButton>
          </div>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="message-item agent">
        <div class="message-avatar">
          <NIcon :component="ConstructOutline" :size="20" />
        </div>
        <div class="message-content">
          <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-banner">
      <NIcon :component="AlertCircleOutline" :size="16" />
      <span>{{ errorMessage }}</span>
      <NButton text size="small" @click="errorMessage = ''">
        <template #icon>
          <NIcon :component="CloseOutline" :size="14" />
        </template>
      </NButton>
    </div>

    <!-- Input -->
    <div class="agent-input">
      <NInput
        v-model:value="inputValue"
        type="textarea"
        placeholder="输入你的创作指令..."
        :autosize="{ minRows: 2, maxRows: 6 }"
        :disabled="isLoading"
        @keydown="handleKeydown"
      />
      <NButton
        type="primary"
        :loading="isLoading"
        :disabled="!inputValue.trim() || isLoading"
        @click="handleSend"
      >
        <template #icon>
          <NIcon :component="SendOutline" :size="16" />
        </template>
        {{ isLoading ? '处理中...' : '执行' }}
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { NButton, NIcon, NInput, NSpin, NTooltip, useMessage } from 'naive-ui'
import {
  ConstructOutline,
  PersonOutline,
  SendOutline,
  CheckmarkCircleOutline,
  EllipsisHorizontalCircleOutline,
  RefreshOutline,
  AlertCircleOutline,
  CloseOutline,
  BookOutline
} from '@vicons/ionicons5'
import { api } from '../api'
import { useAgentStream } from '../composables/useAgentStream'

const props = defineProps<{
  scriptId: string
}>()

const emit = defineEmits<{
  (e: 'apply-content', content: string): void
}>()

const message = useMessage()
const messagesContainer = ref<HTMLElement>()
const { start: startStream } = useAgentStream()

// Agent state
interface AgentMessage {
  role: 'user' | 'agent'
  content: string
  actions?: Array<{
    type: 'confirm' | 'revise'
    label: string
    primary?: boolean
  }>
  step?: number
  totalSteps?: number
  isStreaming?: boolean
}

const messages = ref<AgentMessage[]>([])
const inputValue = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const currentStep = ref(0)
const requiresUserAction = ref(false)
const showMemories = ref(false)
const memories = ref<Array<{ id: string; type: string; title: string; content: string }>>([])

// Step definitions
const steps = ref([
  { key: 'intent', label: '意图解析', status: 'pending' as string },
  { key: 'outline', label: '生成大纲', status: 'pending' as string },
  { key: 'draft', label: '生成草稿', status: 'pending' as string },
  { key: 'review', label: '审核修改', status: 'pending' as string },
  { key: 'complete', label: '完成', status: 'pending' as string }
])

onMounted(() => {
  // Initialize with welcome message
  messages.value = [
    {
      role: 'agent',
      content:
        '你好！我是 AI 编剧 Agent。你可以用自然语言告诉我你想创作什么样的剧本，我会帮你一步步完成从大纲到成稿的全过程。\n\n例如："写一个穿越剧，主角是现代人回到明朝当科学家"'
    }
  ]
})

/**
 * 处理键盘事件
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    handleSend()
  }
}

/**
 * 发送消息（流式）
 */
async function handleSend() {
  if (!inputValue.value.trim() || isLoading.value) return

  const command = inputValue.value.trim()
  inputValue.value = ''
  errorMessage.value = ''

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: command
  })

  await scrollToBottom()

  // 创建流式消息占位符
  const agentMessageIndex = messages.value.length
  messages.value.push({
    role: 'agent',
    content: '',
    isStreaming: true
  })

  isLoading.value = true
  requiresUserAction.value = false

  try {
    await startStream(
      props.scriptId,
      'agent/stream',
      { command },
      {
        onStepStart: (data) => {
          updateStepProgress(data.stepNumber, data.totalSteps)
          messages.value[agentMessageIndex].content += `\n[${data.stepLabel}]\n`
        },
        onToken: (data) => {
          messages.value[agentMessageIndex].content += data.content
          scrollToBottom()
        },
        onStepComplete: (data) => {
          messages.value[agentMessageIndex].isStreaming = false
          // Set message content from result if available
          if (data.result?.summary) {
            messages.value[agentMessageIndex].content = data.result.summary
          }
          if (data.requiresUserAction) {
            messages.value[agentMessageIndex].actions = [
              { type: 'confirm', label: `✅ ${data.actionLabel || '确认'}`, primary: true },
              { type: 'revise', label: '✏️ 修改要求' }
            ]
            requiresUserAction.value = true
          }
        },
        onPause: (data) => {
          messages.value[agentMessageIndex].isStreaming = false
          isLoading.value = false
          // Set message content from result if available
          if (data.result?.summary) {
            messages.value[agentMessageIndex].content = data.result.summary
          }
          if (data.requiresUserAction) {
            messages.value[agentMessageIndex].actions = [
              { type: 'confirm', label: `✅ ${data.actionLabel || '确认'}`, primary: true },
              { type: 'revise', label: '✏️ 修改要求' }
            ]
            requiresUserAction.value = true
          }
        },
        onDone: (data) => {
          isLoading.value = false
          if (data.content) {
            emit('apply-content', data.content)
          }
        },
        onError: (data) => {
          messages.value[agentMessageIndex].isStreaming = false
          errorMessage.value = data.message
          message.error(data.message)
          isLoading.value = false
        }
      }
    )
  } catch (error: any) {
    if (agentMessageIndex < messages.value.length) {
      messages.value[agentMessageIndex].isStreaming = false
    }
    const msg = error.response?.data?.error || error.message
    errorMessage.value = msg
    message.error(msg)
    isLoading.value = false
  } finally {
    await scrollToBottom()
  }
}

/**
 * 加载记忆
 */
async function loadMemories() {
  try {
    const response = await api.get(`/scripts/${props.scriptId}/memories`)
    memories.value = response.data.memories || []
  } catch (error) {
    console.error('Failed to load memories:', error)
  }
}

/**
 * 处理用户操作（确认/修改）- 流式版本
 */
async function handleAction(action: { type: 'confirm' | 'revise' }) {
  if (action.type === 'revise') {
    inputValue.value = ''
    message.info('请输入你的修改要求')
    requiresUserAction.value = false
    return
  }

  // 创建流式消息占位符（使用 index 保证 Vue 响应式更新）
  const agentMessageIndex = messages.value.length
  messages.value.push({
    role: 'agent',
    content: '',
    isStreaming: true
  })

  isLoading.value = true
  errorMessage.value = ''

  try {
    await startStream(
      props.scriptId,
      'agent/confirm/stream',
      { action: 'confirm' },
      {
        onStepStart: (data) => {
          updateStepProgress(data.stepNumber, data.totalSteps)
          messages.value[agentMessageIndex].content += `\n[${data.stepLabel}]\n`
        },
        onToken: (data) => {
          messages.value[agentMessageIndex].content += data.content
          scrollToBottom()
        },
        onStepComplete: (data) => {
          messages.value[agentMessageIndex].isStreaming = false
          if (data.requiresUserAction) {
            messages.value[agentMessageIndex].actions = [
              { type: 'confirm', label: `✅ ${data.actionLabel || '确认'}`, primary: true },
              { type: 'revise', label: '✏️ 修改要求' }
            ]
            requiresUserAction.value = true
          }
        },
        onDone: (data) => {
          messages.value[agentMessageIndex].isStreaming = false
          isLoading.value = false
          if (data.content) {
            emit('apply-content', data.content)
          }
        },
        onError: (data) => {
          messages.value[agentMessageIndex].isStreaming = false
          errorMessage.value = data.message
          message.error(data.message)
          isLoading.value = false
        }
      }
    )
  } catch (error: any) {
    if (agentMessageIndex < messages.value.length) {
      messages.value[agentMessageIndex].isStreaming = false
    }
    const msg = error.message
    errorMessage.value = msg
    message.error(msg)
    isLoading.value = false
  } finally {
    await scrollToBottom()
  }
}

/**
 * 更新步骤进度
 */
function updateStepProgress(step: number, _totalSteps: number) {
  currentStep.value = step

  steps.value.forEach((s, index) => {
    if (index + 1 < step) {
      s.status = 'completed'
    } else if (index + 1 === step) {
      s.status = 'active'
    } else {
      s.status = 'pending'
    }
  })
}

/**
 * 重置会话
 */
async function resetSession() {
  try {
    await api.delete(`/scripts/${props.scriptId}/agent/session`)

    messages.value = [
      {
        role: 'agent',
        content: '对话已重置。请告诉我你想创作什么样的剧本？'
      }
    ]

    currentStep.value = 0
    requiresUserAction.value = false
    steps.value.forEach((s) => {
      s.status = 'pending'
    })
  } catch (error) {
    message.error('重置失败')
  }
}

/**
 * 格式化消息（简单的 markdown 处理）
 */
function formatMessage(content: string): string {
  // 换行转 <br>
  return content.replace(/\n/g, '<br>')
}

/**
 * 滚动到底部
 */
async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}
</script>

<style scoped>
.agent-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-white, #fff);
}

.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
}

.agent-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.agent-icon {
  color: var(--color-primary, #18a058);
}

.header-actions {
  display: flex;
  gap: 4px;
}

/* Memory Viewer */
.memory-viewer {
  padding: 12px 16px;
  background: var(--color-bg-light, #f3f4f6);
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
  max-height: 200px;
  overflow-y: auto;
}

.memory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.memory-title {
  font-weight: 600;
  font-size: 13px;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-item {
  padding: 8px;
  background: var(--color-bg-white, #fff);
  border-radius: 6px;
  font-size: 12px;
}

.memory-type {
  color: var(--color-primary, #18a058);
  font-weight: 600;
  margin-bottom: 2px;
}

.memory-title-text {
  font-weight: 500;
  margin-bottom: 4px;
}

.memory-content {
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.4;
}

.no-memories {
  text-align: center;
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 13px;
  padding: 12px;
}

/* Step Progress */
.step-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-bg-light, #f3f4f6);
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.step-item.step-completed .step-icon {
  color: var(--color-success, #18a058);
}

.step-item.step-active .step-icon {
  color: var(--color-primary, #18a058);
}

.step-item.step-pending .step-icon {
  color: var(--color-text-tertiary, #9ca3af);
}

.step-label {
  color: var(--color-text-base, #374151);
}

.step-item.step-pending .step-label {
  color: var(--color-text-tertiary, #9ca3af);
}

.step-item.step-active .step-label {
  color: var(--color-primary, #18a058);
  font-weight: 500;
}

.step-item.step-completed .step-label {
  color: var(--color-success, #18a058);
}

/* Messages */
.agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-light, #f3f4f6);
}

.message-item.agent .message-avatar {
  background: var(--color-primary-light, #e8f5e9);
  color: var(--color-primary, #18a058);
}

.message-item.user .message-avatar {
  background: var(--color-bg-lighter, #e5e7eb);
  color: var(--color-text-base, #374151);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-text {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-item.agent .message-text {
  background: var(--color-bg-light, #f3f4f6);
}

.message-item.user .message-text {
  background: var(--color-primary, #18a058);
  color: white;
}

.message-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* Loading */
.loading-dots {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  background: var(--color-bg-light, #f3f4f6);
  border-radius: 12px;
  width: fit-content;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-tertiary, #9ca3af);
  animation: loading-bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes loading-bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin: 0 16px 8px;
  background: var(--color-error-light, #fee2e2);
  color: var(--color-error, #ef4444);
  border-radius: 6px;
  font-size: 13px;
}

.error-banner :deep(.n-button) {
  margin-left: auto;
}

/* Input */
.agent-input {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-bg-white, #fff);
}

.agent-input :deep(.n-input) {
  flex: 1;
}

.agent-input :deep(.n-button) {
  align-self: flex-end;
}
</style>
