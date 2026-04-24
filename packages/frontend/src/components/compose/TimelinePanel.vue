<script setup lang="ts">
import { NButton, NImage, NAlert } from 'naive-ui'
import EmptyState from '@/components/EmptyState.vue'
import type { Composition } from '@dreamer/shared/types'
import type { TimelineSegment } from '@/composables/useComposeTimeline'

defineProps<{
  currentComposition: Composition | null
  timelineSegments: TimelineSegment[]
  totalDuration: number
  formatTime: (seconds: number) => string
}>()

const emit = defineEmits<{
  dragstart: [e: DragEvent, index: number]
  drop: [e: DragEvent, index: number]
  dragover: [e: DragEvent]
  remove: [index: number]
  save: []
  preview: []
}>()
</script>

<template>
  <main class="compose-main">
    <EmptyState
      v-if="!currentComposition"
      title="选择或创建合成"
      description="从左侧选择一个合成作品，或创建新的合成"
      icon="🎞️"
    >
      <template #action>
        <NButton type="primary" @click="emit('preview')"> 新建合成 </NButton>
      </template>
    </EmptyState>

    <div v-else class="composition-editor">
      <!-- Timeline Section -->
      <section class="editor-section">
        <div class="editor-section__header">
          <h4 class="editor-section__title"><span>🎬</span> 时间轴</h4>
          <span class="editor-section__duration">{{ formatTime(totalDuration) }}</span>
        </div>

        <div class="timeline-content">
          <div v-if="timelineSegments.length === 0" class="timeline-empty">
            <p>从右侧拖拽分镜片段到此处</p>
          </div>

          <div
            v-for="(segment, index) in timelineSegments"
            :key="`${segment.sceneId}-${index}`"
            class="timeline-segment"
            draggable="true"
            @dragstart="emit('dragstart', $event, index)"
            @drop="emit('drop', $event, index)"
            @dragover="emit('dragover', $event)"
          >
            <div class="timeline-segment__thumb">
              <NImage
                v-if="segment.thumbnailUrl"
                :src="segment.thumbnailUrl"
                width="80"
                height="45"
                object-fit="cover"
                preview-disabled
              />
              <div v-else class="thumb-placeholder">预览</div>
            </div>
            <div class="timeline-segment__info">
              <span class="timeline-segment__title">片段 {{ index + 1 }}</span>
              <span class="timeline-segment__time">
                {{ formatTime(segment.startTime) }} - {{ formatTime(segment.endTime) }}
              </span>
            </div>
            <div class="timeline-segment__actions">
              <NButton size="tiny" quaternary @click="emit('remove', index)"> ✕ </NButton>
            </div>
          </div>
        </div>

        <div class="editor-section__footer">
          <NButton size="small" @click="emit('save')">保存时间轴</NButton>
        </div>
      </section>

      <!-- Export Section -->
      <section v-if="currentComposition.outputUrl" class="editor-section">
        <h4 class="editor-section__title">🎉 成品预览</h4>
        <NButton type="primary" @click="emit('preview')"> 预览导出视频 </NButton>
      </section>

      <!-- Exporting Alert -->
      <NAlert v-if="currentComposition.status === 'processing'" type="warning">
        视频正在拼接导出中，请稍候...
      </NAlert>
    </div>
  </main>
</template>

<style scoped>
.compose-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.composition-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.editor-section {
  background: var(--color-bg-gray);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}

.editor-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.editor-section__title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.editor-section__duration {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.editor-section__footer {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
}

.timeline-content {
  min-height: 100px;
  background: var(--color-bg-white);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-content: flex-start;
}

.timeline-empty {
  width: 100%;
  text-align: center;
  color: var(--color-text-tertiary);
  padding: var(--spacing-xl);
}

.timeline-segment {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--color-bg-gray);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  cursor: grab;
  transition: all var(--transition-fast);
}

.timeline-segment:hover {
  border-color: var(--color-primary);
}

.timeline-segment__thumb {
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.thumb-placeholder {
  width: 80px;
  height: 45px;
  background: var(--color-bg-gray);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.timeline-segment__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-segment__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.timeline-segment__time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.timeline-segment__actions {
  margin-left: auto;
}
</style>
