<script setup lang="ts">
interface Props {
  title: string
  description?: string
  icon?: string
  /** Icon size */
  iconSize?: number
  /** Whether to show a subtle background */
  showBackground?: boolean
  /** Variant for styling */
  variant?: 'default' | 'compact' | 'large'
}

withDefaults(defineProps<Props>(), {
  description: '',
  icon: '📭',
  iconSize: 64,
  showBackground: false,
  variant: 'default'
})
</script>

<template>
  <div :class="['empty-state', `empty-state--${variant}`, { 'empty-state--bg': showBackground }]">
    <div class="empty-state__icon" :style="{ fontSize: `${iconSize}px` }">
      <slot name="icon">{{ icon }}</slot>
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
  text-align: center;
  transition: all var(--transition-normal);
}

.empty-state--default {
  padding: var(--spacing-2xl);
}

.empty-state--compact {
  padding: var(--spacing-lg);
}

.empty-state--large {
  padding: var(--spacing-2xl) var(--spacing-xl);
}

.empty-state--bg {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--color-border);
}

.empty-state__icon {
  margin-bottom: var(--spacing-md);
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
  user-select: none;
}

.empty-state__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
  line-height: var(--line-height-tight);
}

.empty-state__description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  max-width: 400px;
  line-height: var(--line-height-relaxed);
  margin-bottom: var(--spacing-lg);
}

.empty-state__action {
  margin-top: var(--spacing-md);
  display: flex;
  gap: var(--spacing-sm);
}

/* Floating animation for icon */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
</style>
