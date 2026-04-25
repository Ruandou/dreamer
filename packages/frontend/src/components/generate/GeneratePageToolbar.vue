<script setup lang="ts">
import { NButton } from 'naive-ui'

defineProps<{
  isLoading: boolean
}>()

defineEmits<{
  (e: 'save-draft'): void
}>()
</script>

<template>
  <div class="generate-toolbar">
    <h1 class="page-title-inline">生成大纲</h1>
    <NButton size="small" :disabled="isLoading" @click="$emit('save-draft')">保存草稿</NButton>
  </div>
</template>

<style scoped>
.generate-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.page-title-inline {
  margin: 0;
  font-size: var(--font-size-xl);
}
</style>
