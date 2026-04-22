<template>
  <div class="quick-command-bar">
    <div class="command-group">
      <NButton
        v-for="cmd in commands"
        :key="cmd.id"
        size="small"
        :disabled="disabled"
        @click="$emit('command', cmd.id)"
      >
        {{ cmd.label }}
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'

defineProps<{
  disabled?: boolean
}>()

defineEmits<{
  (e: 'command', commandId: string): void
}>()

const commands = [
  { id: 'continue', label: '续写' },
  { id: 'polish', label: '润色' },
  { id: 'expand', label: '扩写' },
  { id: 'shorten', label: '缩写' }
]
</script>

<style scoped>
.quick-command-bar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
}

.command-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
