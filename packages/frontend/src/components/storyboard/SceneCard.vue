<script setup lang="ts">
import { NCheckbox, NButton, NSpace } from 'naive-ui'
import StatusBadge from '@/components/StatusBadge.vue'
import TaskItem from './TaskItem.vue'
import type { SceneWithTakes } from '@/stores/scene'

defineProps<{
  scene: SceneWithTakes
  index: number
  isSelected: boolean
}>()

const emit = defineEmits<{
  edit: [scene: SceneWithTakes]
  generate: [sceneId: string]
  delete: [sceneId: string]
  'select-task': [sceneId: string, taskId: string]
  'preview-video': [videoUrl: string, thumbnailUrl?: string]
  'toggle-selection': [sceneId: string]
  'drag-start': [e: DragEvent, index: number]
  drop: [e: DragEvent, index: number]
}>()

function primaryPrompt(scene: SceneWithTakes): string {
  const shots = scene.shots as { description?: string }[] | undefined
  const first = shots?.[0]?.description?.trim()
  if (first) return first
  return scene.description?.trim() || '使用场景描述'
}

function getSceneTakes(scene: SceneWithTakes) {
  return scene.takes ?? []
}
</script>

<template>
  <div
    class="scene-card"
    draggable="true"
    @dragstart="emit('drag-start', $event as DragEvent, index)"
    @drop="emit('drop', $event as DragEvent, index)"
    @dragover.prevent
  >
    <!-- Scene Header -->
    <div class="scene-card__header" @click="emit('edit', scene)">
      <div class="scene-card__info">
        <StatusBadge :status="scene.status" />
        <span class="scene-card__num">#{{ scene.sceneNum }}</span>
        <span class="scene-card__desc">{{ scene.description || '未描述' }}</span>
      </div>
      <div class="scene-card__select" @click.stop>
        <NCheckbox :checked="isSelected" @update:checked="() => emit('toggle-selection', scene.id)">
          选中
        </NCheckbox>
      </div>
    </div>

    <!-- Scene Content -->
    <div class="scene-card__content">
      <!-- Prompt -->
      <div class="scene-card__prompt">
        <span class="prompt-label">提示词</span>
        <span class="prompt-text">{{ primaryPrompt(scene) }}</span>
      </div>

      <!-- Tasks -->
      <div v-if="getSceneTakes(scene).length" class="scene-card__tasks">
        <TaskItem
          v-for="task in getSceneTakes(scene)"
          :key="task.id"
          :task="task"
          @select="emit('select-task', scene.id, task.id)"
          @preview="task.videoUrl && emit('preview-video', task.videoUrl, task.thumbnailUrl)"
        />
      </div>
    </div>

    <!-- Scene Footer -->
    <div class="scene-card__footer">
      <NSpace>
        <NButton
          v-if="scene.status !== 'processing'"
          size="small"
          type="primary"
          @click="emit('generate', scene.id)"
        >
          生成视频
        </NButton>
        <NButton size="small" @click="emit('edit', scene)"> 编辑 </NButton>
        <NButton size="small" type="error" text @click="emit('delete', scene.id)"> 删除 </NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.scene-card {
  background: var(--color-bg-gray);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  cursor: grab;
  transition: all var(--transition-fast);
}

.scene-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.scene-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  cursor: pointer;
}

.scene-card__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.scene-card__num {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.scene-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-card__select {
  flex-shrink: 0;
}

.scene-card__content {
  margin-bottom: var(--spacing-md);
}

.scene-card__prompt {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-sm);
}

.prompt-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.prompt-text {
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}

.scene-card__tasks {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.scene-card__footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}
</style>
