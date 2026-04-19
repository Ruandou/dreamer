<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, NSpace, NIcon } from 'naive-ui'
import { AlertCircleOutline, RefreshOutline } from '@vicons/ionicons5'

interface Props {
  /** Error message to display */
  error?: string
  /** Whether error state is active */
  hasError?: boolean
  /** Custom title for error state */
  title?: string
  /** Whether to show retry button */
  showRetry?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  error: '',
  hasError: false,
  title: '出错了',
  showRetry: true
})

const emit = defineEmits<{
  retry: []
}>()

const isRetrying = ref(false)

const displayError = computed(() => {
  return props.error || '加载失败，请稍后重试'
})

const handleRetry = async () => {
  isRetrying.value = true
  try {
    emit('retry')
  } finally {
    // Give some time for the retry operation to start
    setTimeout(() => {
      isRetrying.value = false
    }, 500)
  }
}
</script>

<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-boundary__icon">
      <NIcon :component="AlertCircleOutline" :size="48" color="var(--color-error)" />
    </div>
    <h3 class="error-boundary__title">{{ title }}</h3>
    <p class="error-boundary__message">{{ displayError }}</p>
    <NSpace v-if="showRetry" class="error-boundary__actions">
      <NButton type="primary" :loading="isRetrying" @click="handleRetry">
        <template #icon>
          <NIcon :component="RefreshOutline" />
        </template>
        重试
      </NButton>
    </NSpace>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  text-align: center;
  background: var(--color-error-light);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-error);
}

.error-boundary__icon {
  margin-bottom: var(--spacing-md);
  opacity: 0.8;
}

.error-boundary__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-error);
  margin-bottom: var(--spacing-sm);
}

.error-boundary__message {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
  max-width: 400px;
}

.error-boundary__actions {
  margin-top: var(--spacing-md);
}
</style>
