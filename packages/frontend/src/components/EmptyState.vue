<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <slot name="icon">{{ icon || '📭' }}</slot>
    </div>
    <h3 class="empty-state__title">{{ title }}</h3>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  text-align: center;
}

.empty-state__icon {
  font-size: 64px;
  margin-bottom: var(--spacing-md);
  opacity: 0.8;
}

.empty-state__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.empty-state__description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  max-width: 320px;
  line-height: var(--line-height-relaxed);
}

.empty-state__action {
  margin-top: var(--spacing-lg);
}
</style>
