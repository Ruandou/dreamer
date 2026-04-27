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
          <div v-if="message.role === 'agent'" class="message-text">
            <MarkdownRenderer :content="sanitizeContent(message.content)" />
            <span v-if="message.isStreaming" class="streaming-cursor"></span>
          </div>
          <div v-else class="message-text">{{ sanitizeContent(message.content) }}</div>

          <!-- Step Result (separate, not mixed in content) -->
          <div v-if="message.stepResult" class="step-result-block">
            <strong>结果摘要：</strong>
            <MarkdownRenderer :content="sanitizeContent(message.stepResult)" />
          </div>

          <!-- Step Transitions (rendered as chips, not in content) -->
          <div v-if="message.stepTransitions?.length" class="step-transitions">
            <span v-for="(step, si) in message.stepTransitions" :key="si" class="step-chip">
              {{ step.label }}
            </span>
          </div>

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

      <!-- Scroll to Bottom Button -->
      <transition name="fade">
        <NButton
          v-if="showScrollButton"
          class="scroll-to-bottom-btn"
          size="tiny"
          circle
          @click="scrollToBottomNow"
        >
          <template #icon>
            <NIcon :component="ArrowDownOutline" :size="14" />
          </template>
        </NButton>
      </transition>
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
      <ReferenceInput
        ref="inputRef"
        placeholder="输入你的创作指令..."
        :disabled="isLoading"
        :reference="reference"
        send-modifier="ctrl"
        @send="handleInputSend"
        @clear-reference="emit('clear-reference')"
      />
      <div class="input-actions">
        <span class="input-hint"> Ctrl+Enter 发送 </span>
        <div class="input-actions-right">
          <NSelect
            v-model:value="selectedModel"
            :options="modelOptions"
            size="tiny"
            placeholder="选择模型"
            class="inline-model-select"
          />
          <NButton
            :type="isLoading ? 'error' : 'primary'"
            :loading="isLoading"
            size="small"
            @click="handleSendOrStop"
          >
            <template #icon>
              <NIcon :component="isLoading ? StopCircleOutline : SendOutline" :size="16" />
            </template>
            {{ isLoading ? '停止' : '执行' }}
          </NButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed } from 'vue'
import { NButton, NIcon, NSpin, NTooltip, useMessage, NSelect } from 'naive-ui'
import {
  ConstructOutline,
  PersonOutline,
  SendOutline,
  StopCircleOutline,
  CheckmarkCircleOutline,
  EllipsisHorizontalCircleOutline,
  RefreshOutline,
  AlertCircleOutline,
  CloseOutline,
  BookOutline,
  ArrowDownOutline
} from '@vicons/ionicons5'
import { api } from '../api'
import { useAgentStream } from '../composables/useAgentStream'
import { useSmartScroll } from '../composables/useSmartScroll'
import { useModelPreferenceStore } from '../stores/model-preference'
import { sanitizeContent } from '../stores/chat'
import MarkdownRenderer from './chat/MarkdownRenderer.vue'
import ReferenceInput from './chat/ReferenceInput.vue'

const props = defineProps<{
  scriptId: string
  reference?: { text: string; startLine: number; endLine: number } | null
}>()

const emit = defineEmits<{
  (e: 'apply-content', content: string): void
  (e: 'clear-reference'): void
}>()

const message = useMessage()
const messagesContainer = ref<HTMLElement>()
const { start: startStream, abort: abortStream } = useAgentStream()
const { scrollToBottom, scrollToBottomNow, showScrollButton } = useSmartScroll(messagesContainer)
const modelStore = useModelPreferenceStore()

const modelOptions = computed(() =>
  modelStore.textModels.map((m) => ({ label: m.name, value: m.id }))
)

const selectedModel = computed<string | undefined>({
  get: () => modelStore.currentTextModel || modelStore.defaultTextModel,
  set: (val: string | undefined) => {
    modelStore.currentTextModel = val
  }
})

// Agent state
interface AgentMessage {
  role: 'user' | 'agent'
  content: string
  actions?: Array<{
    type: 'confirm' | 'revise'
    label: string
    primary?: boolean
  }>
  stepTransitions?: Array<{ label: string; atCharIndex: number }>
  stepResult?: string
  step?: number
  totalSteps?: number
  isStreaming?: boolean
}

const messages = ref<AgentMessage[]>([])
const inputRef = ref<InstanceType<typeof ReferenceInput> | null>(null)
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

onMounted(async () => {
  // Ensure model catalog is loaded for the selector
  await modelStore.init()

  // Initialize with welcome message
  messages.value = [
    {
      role: 'agent',
      content:
        '你好！我是 AI 编剧 Agent。你可以用自然语言告诉我你想创作什么样的剧本，我会帮你一步步完成从大纲到成稿的全过程。\n\n例如："写一个穿越剧，主角是现代人回到明朝当科学家"'
    }
  ]

  // Scroll to bottom on initial load
  nextTick(() => scrollToBottom(true))
})

/**
 * 从 ReferenceInput DOM 中提取用户输入的文本
 */
function getInputText(): string {
  const el = inputRef.value?.$el as HTMLDivElement | null
  if (!el) return ''
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.ref-chip').forEach((c) => c.remove())
  return clone.innerText?.trim() || ''
}

/**
 * ReferenceInput 的 send 事件 (Ctrl+Enter)
 */
function handleInputSend(text: string) {
  doSend(text)
}

/**
 * 发送消息 或 停止当前流式输出
 */
function handleSendOrStop() {
  if (isLoading.value) {
    abortStream()
    isLoading.value = false
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === 'agent') {
      lastMsg.isStreaming = false
      if (!lastMsg.content) lastMsg.content = '（已取消）'
    }
    return
  }
  const text = getInputText()
  if (!text) return
  doSend(text)
}

function doSend(text: string) {
  let command = text

  if (props.reference) {
    command =
      `引用的内容 (L${props.reference.startLine}-L${props.reference.endLine}):\n\n` +
      `\`\`\`\n${props.reference.text}\n\`\`\`\n\n` +
      `请修改以上内容：\n${command}`
    emit('clear-reference')
  }

  // Clear the editor
  const el = inputRef.value?.$el as HTMLDivElement | null
  if (el) el.innerText = ''

  errorMessage.value = ''

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: command
  })

  nextTick(() => {
    scrollToBottom(true)
    startStreaming(command)
  })
}

/**
 * 启动流式 AI 生成
 */
async function startStreaming(command: string) {
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
      { command, model: selectedModel.value },
      {
        onStepStart: (data) => {
          updateStepProgress(data.stepNumber, data.totalSteps)
          const msg = messages.value[agentMessageIndex]
          if (!msg.stepTransitions) msg.stepTransitions = []
          msg.stepTransitions.push({
            label: data.stepLabel,
            atCharIndex: msg.content.length
          })
        },
        onToken: (data) => {
          messages.value[agentMessageIndex].content += data.content
          scrollToBottom()
        },
        onStepComplete: (data) => {
          messages.value[agentMessageIndex].isStreaming = false
          if (data.result?.summary) {
            messages.value[agentMessageIndex].stepResult = data.result.summary
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
          if (data.result?.summary) {
            messages.value[agentMessageIndex].stepResult = data.result.summary
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
    const msg = error.response?.data?.error || error.message
    errorMessage.value = msg
    message.error(msg)
    isLoading.value = false
  } finally {
    scrollToBottom()
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
    // Clear input
    const el = inputRef.value?.$el as HTMLDivElement | null
    if (el) el.innerText = ''
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
      { action: 'confirm', model: selectedModel.value },
      {
        onStepStart: (data) => {
          updateStepProgress(data.stepNumber, data.totalSteps)
          // Record step transition as structured data, not appended to content
          const msg = messages.value[agentMessageIndex]
          if (!msg.stepTransitions) msg.stepTransitions = []
          msg.stepTransitions.push({
            label: data.stepLabel,
            atCharIndex: msg.content.length
          })
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
    scrollToBottom()
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
  align-items: center;
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
  padding: 12px 16px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-bg-white, #fff);
}

/* ReferenceInput border styling */
.agent-input :deep(.reference-input) {
  margin-bottom: 8px;
  border: 2px solid var(--color-border-light, #e5e7eb);
  border-radius: var(--radius-lg);
  background: var(--color-bg-white, #fff);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.agent-input :deep(.reference-input.is-focused) {
  border-color: var(--color-primary, #18a058);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  user-select: none;
}

.input-actions-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inline-model-select {
  width: 120px;
  flex-shrink: 0;
}

.inline-model-select :deep(.n-base-selection) {
  background: transparent;
}

/* Streaming Cursor */
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

/* Step Transitions (chips) */
.step-transitions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.step-chip {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-md);
  background: var(--color-primary-light, #e8f5e9);
  color: var(--color-primary, #18a058);
  white-space: nowrap;
}

/* Step Result Block */
.step-result-block {
  margin-top: 10px;
  padding: 10px 14px;
  border-left: 3px solid var(--color-primary, #18a058);
  background: var(--color-bg-light, #f3f4f6);
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.5;
}

.step-result-block :deep(.markdown-body) {
  font-size: 13px;
}

/* Scroll To Bottom Button */
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 80px;
  right: 20px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
</style>
