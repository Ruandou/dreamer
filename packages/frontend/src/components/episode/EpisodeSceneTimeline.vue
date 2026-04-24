<script setup lang="ts">
interface SceneRailItem {
  id: string
  sceneNum: number
  status?: string
}

defineProps<{
  scenes: SceneRailItem[]
  selectedSceneId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', sceneId: string): void
}>()

function selectScene(sceneId: string) {
  emit('select', sceneId)
}
</script>

<template>
  <footer class="episode-scene-timeline__rail">
    <button
      v-for="sc in scenes"
      :key="sc.id"
      type="button"
      class="episode-scene-timeline__rail-cell"
      :class="{ 'is-active': sc.id === selectedSceneId }"
      @click="selectScene(sc.id)"
    >
      <div class="episode-scene-timeline__rail-thumb">
        <span class="episode-scene-timeline__rail-num">{{ sc.sceneNum }}</span>
      </div>
      <span class="episode-scene-timeline__rail-dur">{{
        sc.status === 'processing' ? '生成中' : sc.status || '待生成'
      }}</span>
    </button>
  </footer>
</template>

<style scoped>
.episode-scene-timeline__rail {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: var(--spacing-sm) 0 var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
}
.episode-scene-timeline__rail-cell {
  flex: 0 0 auto;
  width: 100px;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  padding: 6px;
  background: var(--color-bg-gray);
  cursor: pointer;
  text-align: center;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.episode-scene-timeline__rail-cell.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.episode-scene-timeline__rail-thumb {
  position: relative;
  height: 64px;
  border-radius: 6px;
  background: #e2e8f0;
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-bottom: 4px;
  font-size: 10px;
  color: var(--color-text-tertiary);
  overflow: hidden;
}
.episode-scene-timeline__rail-thumb.is-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(15, 23, 42, 0.55), transparent 55%);
  pointer-events: none;
}
.episode-scene-timeline__rail-num {
  position: relative;
  z-index: 1;
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-secondary);
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
}
.episode-scene-timeline__rail-thumb.is-cover {
  justify-content: flex-start;
  align-items: stretch;
}
.episode-scene-timeline__rail-thumb.is-cover .episode-scene-timeline__rail-num {
  align-self: flex-end;
  margin: 4px 6px 0;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
}
.episode-scene-timeline__rail-ph {
  font-size: 10px;
}
.episode-scene-timeline__rail-dur {
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
