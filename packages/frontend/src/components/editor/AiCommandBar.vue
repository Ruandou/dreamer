<template>
  <div class="ai-command-bar">
    <div class="command-input-wrapper">
      <textarea
        ref="inputRef"
        v-model="commandText"
        class="command-input"
        :placeholder="placeholder"
        :disabled="isStreaming || disabled"
        rows="1"
        @keydown="handleKeydown"
        @input="autoResize"
      />
      <div class="command-actions">
        <NSelect
          v-model:value="selectedModel"
          :options="modelOptions"
          size="tiny"
          placeholder="模型"
          class="model-select"
        />
        <NButton
          :type="isStreaming ? 'error' : 'primary'"
          :loading="isStreaming"
          :disabled="(!commandText.trim() && !isStreaming) || disabled"
          size="small"
          @click="handleSend"
        >
          <template #icon>
            <NIcon :component="isStreaming ? StopCircleOutline : SparklesOutline" :size="16" />
          </template>
          {{ isStreaming ? '停止' : 'AI 编辑' }}
        </NButton>
      </div>
    </div>

    <div class="quick-commands">
      <NButton
        v-for="cmd in quickCommands"
        :key="cmd.id"
        size="tiny"
        quaternary
        :disabled="isStreaming || disabled"
        @click="handleQuickCommand(cmd.id)"
      >
        <template #icon>
          <NIcon :component="cmd.icon" :size="14" />
        </template>
        {{ cmd.label }}
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { NButton, NIcon, NSelect } from 'naive-ui'
import {
  SparklesOutline,
  StopCircleOutline,
  CreateOutline,
  ColorWandOutline,
  ExpandOutline,
  ContractOutline
} from '@vicons/ionicons5'
import { useModelPreferenceStore } from '@/stores/model-preference'

const props = defineProps<{
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  send: [command: string, model?: string]
  abort: []
  'quick-command': [commandId: string, model?: string]
}>()

const inputRef = ref<HTMLTextAreaElement | null>(null)
const commandText = ref('')
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

const quickCommands = [
  { id: 'continue', label: '续写', icon: CreateOutline },
  { id: 'polish', label: '润色', icon: ColorWandOutline },
  { id: 'expand', label: '扩写', icon: ExpandOutline },
  { id: 'shorten', label: '缩写', icon: ContractOutline }
]

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  if (props.isStreaming) {
    emit('abort')
    return
  }
  const text = commandText.value.trim()
  if (!text) return
  emit('send', text, selectedModel.value)
  commandText.value = ''
  nextTick(() => autoResize())
}

function handleQuickCommand(commandId: string) {
  emit('quick-command', commandId, selectedModel.value)
}

function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}
</script>

<style scoped>
.ai-command-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-bg-white);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.command-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.command-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-white);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  color: var(--color-text-primary);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
  min-height: 36px;
  max-height: 120px;
}

.command-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.command-input:disabled {
  background: var(--color-bg-gray);
  color: var(--color-text-tertiary);
}

.command-input::placeholder {
  color: var(--color-text-tertiary);
}

.command-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.model-select {
  width: 130px;
}

.model-select :deep(.n-base-selection) {
  background: transparent;
}

.quick-commands {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
</style>
