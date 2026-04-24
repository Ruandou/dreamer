<script setup lang="ts">
import { NScrollbar } from 'naive-ui'
import StatusBadge from '@/components/StatusBadge.vue'
import type { Composition } from '@dreamer/shared/types'

defineProps<{
  compositions: Composition[]
  currentComposition: Composition | null
}>()

const emit = defineEmits<{
  select: [composition: Composition]
}>()
</script>

<template>
  <aside class="compose-sidebar">
    <div class="sidebar-header">
      <span>合成作品</span>
    </div>
    <NScrollbar>
      <div v-if="compositions.length === 0" class="sidebar-empty">暂无合成</div>
      <div
        v-for="comp in compositions"
        :key="comp.id"
        :class="['composition-item', { active: currentComposition?.id === comp.id }]"
        @click="emit('select', comp)"
      >
        <span class="composition-item__title">{{ comp.title }}</span>
        <StatusBadge
          :status="
            comp.status === 'completed'
              ? 'completed'
              : comp.status === 'processing'
                ? 'processing'
                : 'draft'
          "
          size="small"
        />
      </div>
    </NScrollbar>
  </aside>
</template>

<style scoped>
.compose-sidebar {
  width: 200px;
  background: var(--color-bg-gray);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: var(--spacing-md);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
}

.sidebar-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.composition-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-light);
  transition: all var(--transition-fast);
}

.composition-item:hover {
  background: var(--color-bg-white);
}

.composition-item.active {
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
}

.composition-item__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
</style>
