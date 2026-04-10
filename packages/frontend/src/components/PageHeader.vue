<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
  backText?: string
}>()

defineEmits<{
  back: []
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__left">
      <button v-if="showBack" class="page-header__back" @click="$emit('back')">
        <span class="page-header__back-icon">←</span>
        {{ backText || '返回' }}
      </button>
      <div class="page-header__info">
        <h1 class="page-header__title">{{ title }}</h1>
        <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div class="page-header__right">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.page-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.page-header__back {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.page-header__back:hover {
  background: var(--color-bg-gray);
  color: var(--color-text-primary);
}

.page-header__back-icon {
  font-size: var(--font-size-base);
}

.page-header__info {
  display: flex;
  flex-direction: column;
}

.page-header__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.page-header__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.page-header__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
</style>
