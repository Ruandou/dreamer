<template>
  <div class="quick-command-bar">
    <div class="command-group">
      <NTooltip v-for="cmd in commands" :key="cmd.id" trigger="hover" :disabled="disabled">
        <template #trigger>
          <NButton
            size="small"
            :disabled="disabled"
            class="command-btn"
            @click="$emit('command', cmd.id)"
          >
            <template #icon>
              <NIcon :component="cmd.icon" :size="14" />
            </template>
            {{ cmd.label }}
          </NButton>
        </template>
        {{ cmd.hint }}
      </NTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon, NTooltip } from 'naive-ui'
import {
  PlayForwardOutline,
  SparklesOutline,
  ExpandOutline,
  ContractOutline
} from '@vicons/ionicons5'

defineProps<{
  disabled?: boolean
}>()

defineEmits<{
  (e: 'command', commandId: string): void
}>()

const commands = [
  { id: 'continue', label: '续写', icon: PlayForwardOutline, hint: '基于当前内容继续创作' },
  { id: 'polish', label: '润色', icon: SparklesOutline, hint: '优化文字表达与流畅度' },
  { id: 'expand', label: '扩写', icon: ExpandOutline, hint: '丰富细节，增加篇幅' },
  { id: 'shorten', label: '缩写', icon: ContractOutline, hint: '精简内容，保留核心' }
]
</script>

<style scoped>
.quick-command-bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
  background: var(--color-bg-white);
}

.command-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.command-btn {
  transition: all var(--transition-fast);
}

.command-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
</style>
