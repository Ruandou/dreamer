<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** Number of skeleton rows to display */
  rows?: number
  /** Height of each skeleton row */
  rowHeight?: string
  /** Whether to show a header skeleton */
  showHeader?: boolean
  /** Whether to show an avatar/image skeleton */
  showAvatar?: boolean
  /** Skeleton variant */
  variant?: 'card' | 'list' | 'table' | 'grid'
}

const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  rowHeight: '16px',
  showHeader: true,
  showAvatar: false,
  variant: 'card'
})

const skeletonRows = computed(() => Array.from({ length: props.rows }))
</script>

<template>
  <div :class="['skeleton-loader', `skeleton-loader--${variant}`]">
    <!-- Avatar/ Image Skeleton -->
    <div v-if="showAvatar" class="skeleton-loader__avatar skeleton-animate" />

    <!-- Header Skeleton -->
    <div v-if="showHeader" class="skeleton-loader__header">
      <div class="skeleton-line skeleton-line--lg skeleton-animate" />
      <div class="skeleton-line skeleton-line--sm skeleton-animate" />
    </div>

    <!-- Content Rows -->
    <div class="skeleton-loader__content">
      <div
        v-for="(_, index) in skeletonRows"
        :key="index"
        class="skeleton-line skeleton-animate"
        :style="{ height: rowHeight }"
        :class="{
          'skeleton-line--full': index === skeletonRows.length - 1,
          'skeleton-line--short': index % 3 === 0
        }"
      />
    </div>

    <!-- Action Buttons Skeleton -->
    <div class="skeleton-loader__actions">
      <div class="skeleton-button skeleton-animate" />
      <div class="skeleton-button skeleton-animate" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
}

.skeleton-loader--list {
  background: transparent;
  padding: 0;
}

.skeleton-loader--table {
  background: transparent;
  padding: 0;
}

.skeleton-loader--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
  background: transparent;
  padding: 0;
}

.skeleton-loader__avatar {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: var(--color-border-light);
  margin-bottom: var(--spacing-sm);
}

.skeleton-loader__header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.skeleton-loader__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.skeleton-loader__actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.skeleton-line {
  height: 16px;
  background: linear-gradient(
    90deg,
    var(--color-border-light) 25%,
    var(--color-border) 50%,
    var(--color-border-light) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  width: 100%;
}

.skeleton-line--lg {
  height: 24px;
  width: 60%;
}

.skeleton-line--sm {
  height: 12px;
  width: 40%;
}

.skeleton-line--short {
  width: 70%;
}

.skeleton-line--full {
  width: 100%;
}

.skeleton-button {
  width: 100px;
  height: 36px;
  background: var(--color-border-light);
  border-radius: var(--radius-md);
}

/* Animation */
.skeleton-animate {
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
