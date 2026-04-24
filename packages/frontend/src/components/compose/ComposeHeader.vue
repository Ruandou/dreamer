<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useCompositionStore } from '@/stores/composition'

defineProps<{
  totalDuration: number
  formatTime: (seconds: number) => string
}>()

const emit = defineEmits<{
  'create-composition': []
  export: []
}>()

const compositionStore = useCompositionStore()
</script>

<template>
  <header class="compose-header">
    <div class="compose-header__left">
      <h2 class="compose-header__title">视频合成</h2>
      <span class="compose-header__duration" v-if="totalDuration > 0">
        总时长 {{ formatTime(totalDuration) }}
      </span>
    </div>
    <div class="compose-header__right">
      <NButton @click="emit('create-composition')">
        <template #icon>+</template>
        新建合成
      </NButton>
      <NButton
        v-if="compositionStore.currentComposition"
        type="primary"
        :loading="compositionStore.isExporting"
        @click="emit('export')"
      >
        导出视频
      </NButton>
    </div>
  </header>
</template>

<style scoped>
.compose-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.compose-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.compose-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.compose-header__duration {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-gray);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
}

.compose-header__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
</style>
