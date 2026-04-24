<script setup lang="ts">
import type { Character } from '@dreamer/shared/types'

defineProps<{
  characters: Character[]
  activeCharacterId: string
}>()

const emit = defineEmits<{
  switchCharacter: [id: string]
}>()
</script>

<template>
  <aside class="character-rail character-rail--tabs" aria-label="切换角色">
    <div class="character-rail__title">角色</div>
    <nav class="character-rail__tablist" role="tablist">
      <button
        v-for="c in characters"
        :key="c.id"
        type="button"
        role="tab"
        class="character-rail__tab"
        :class="{ 'character-rail__tab--active': c.id === activeCharacterId }"
        :aria-selected="c.id === activeCharacterId"
        @click="emit('switchCharacter', c.id)"
      >
        {{ c.name }}
      </button>
    </nav>
  </aside>
</template>

<style scoped>
/* 左侧纵向 Tab（线型 + 当前项指示条，与 Naive line tabs 气质一致） */
.character-rail--tabs {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.character-rail__title {
  flex-shrink: 0;
  padding: 10px 12px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-gray);
}

.character-rail__tablist {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.character-rail__tab {
  position: relative;
  text-align: left;
  width: 100%;
  padding: 10px 14px 10px 12px;
  margin: 0;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  background: transparent;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-primary);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-rail__tab:last-child {
  border-bottom: none;
}

.character-rail__tab:hover:not(.character-rail__tab--active) {
  background: var(--color-bg-gray);
}

.character-rail__tab--active {
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  background: var(--color-primary-light);
}

.character-rail__tab--active::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-primary);
  border-radius: 2px 0 0 2px;
}

.character-rail__tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}
</style>
