<script setup lang="ts">
import { NButton, NImage, NScrollbar } from 'naive-ui'
import type { AvailableSegment } from '@/composables/useComposeTimeline'

defineProps<{
  segments: AvailableSegment[]
}>()

const emit = defineEmits<{
  add: [segment: AvailableSegment]
  dragstart: [e: DragEvent, segment: AvailableSegment]
}>()

const onDragStart = (e: DragEvent, segment: AvailableSegment) => {
  ;(e.dataTransfer as DataTransfer).setData('application/json', JSON.stringify(segment))
  ;(e.dataTransfer as DataTransfer).effectAllowed = 'copy'
}
</script>

<template>
  <aside class="compose-sidebar">
    <div class="sidebar-header">
      <span>可用分镜</span>
    </div>
    <NScrollbar>
      <div v-if="segments.length === 0" class="sidebar-empty">暂无可用分镜</div>
      <div
        v-for="segment in segments"
        :key="segment.sceneId"
        class="segment-source"
        draggable="true"
        @dragstart="onDragStart($event, segment)"
      >
        <div class="segment-source__thumb">
          <NImage
            v-if="segment.thumbnailUrl"
            :src="segment.thumbnailUrl"
            width="60"
            height="34"
            object-fit="cover"
            preview-disabled
          />
          <div v-else class="thumb-placeholder">预览</div>
        </div>
        <div class="segment-source__info">
          <span class="segment-source__title">#{{ segment.sceneNum }}</span>
          <span class="segment-source__duration">{{ segment.duration }}秒</span>
        </div>
        <NButton size="tiny" @click="emit('add', segment)">+</NButton>
      </div>
    </NScrollbar>
  </aside>
</template>

<style scoped>
.compose-sidebar {
  width: 200px;
  background: var(--color-bg-gray);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: var(--spacing-md);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
}

.sidebar-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.segment-source {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
  cursor: grab;
  transition: all var(--transition-fast);
}

.segment-source:hover {
  background: var(--color-bg-white);
}

.segment-source__thumb {
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.segment-source__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.segment-source__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.segment-source__duration {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.thumb-placeholder {
  width: 60px;
  height: 34px;
  background: var(--color-bg-gray);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
</style>
