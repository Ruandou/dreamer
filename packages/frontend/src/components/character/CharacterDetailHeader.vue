<script setup lang="ts">
import { NButton } from 'naive-ui'
import type { Character } from '@dreamer/shared/types'

defineProps<{
  character: Character | null
  hasRootBase: boolean
}>()

const emit = defineEmits<{
  back: []
  addImage: []
}>()
</script>

<template>
  <header class="detail-header">
    <div class="detail-header__left">
      <NButton quaternary @click="emit('back')">
        <template #icon>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </template>
        返回
      </NButton>
      <div class="detail-header__info" v-if="character">
        <h1 class="detail-header__title">{{ character.name }}</h1>
        <p class="detail-header__desc">{{ character.description || '暂无描述' }}</p>
      </div>
    </div>
    <div class="detail-header__right">
      <NButton v-if="!hasRootBase" type="primary" @click="emit('addImage')">
        <template #icon>+</template>
        添加基础形象
      </NButton>
    </div>
  </header>
</template>

<style scoped>
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
  gap: var(--spacing-md);
}

.detail-header__left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.detail-header__info {
  padding-top: 4px;
}

.detail-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.detail-header__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--spacing-xs) 0 0;
}
</style>
