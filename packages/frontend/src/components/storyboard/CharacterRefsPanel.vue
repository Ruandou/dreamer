<script setup lang="ts">
import { NImage, NScrollbar } from 'naive-ui'
import type { Character } from '@dreamer/shared/types'

const props = defineProps<{
  characters: Character[]
  selectedImage?: string
}>()

const emit = defineEmits<{
  'update:selectedImage': [url: string | undefined]
}>()

function characterPreviewUrl(char: { images?: { avatarUrl?: string }[] }): string | undefined {
  return char.images?.find((i) => i.avatarUrl)?.avatarUrl
}

function handleSelect(char: { images?: { avatarUrl?: string }[] }) {
  const url = characterPreviewUrl(char)
  if (props.selectedImage === url) {
    emit('update:selectedImage', undefined)
  } else {
    emit('update:selectedImage', url)
  }
}
</script>

<template>
  <div class="character-refs">
    <h4 class="character-refs__title">角色参考图</h4>
    <NScrollbar x-scrollable>
      <div class="character-refs__list">
        <div
          v-for="char in characters"
          :key="char.id"
          :class="['ref-item', { active: selectedImage === characterPreviewUrl(char) }]"
          @click="handleSelect(char)"
        >
          <NImage
            v-if="characterPreviewUrl(char)"
            :src="characterPreviewUrl(char)"
            width="60"
            height="60"
            object-fit="cover"
          />
          <div v-else class="ref-placeholder">{{ char.name.charAt(0) }}</div>
          <span class="ref-name">{{ char.name }}</span>
        </div>
      </div>
    </NScrollbar>
  </div>
</template>

<style scoped>
.character-refs {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.character-refs__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
}

.character-refs__list {
  display: flex;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
}

.ref-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.ref-item:hover {
  background: var(--color-bg-gray);
}

.ref-item.active {
  background: var(--color-primary-light);
}

.ref-item.active .ref-name {
  color: var(--color-primary);
}

.ref-placeholder {
  width: 60px;
  height: 60px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: var(--font-weight-bold);
}

.ref-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
