<script setup lang="ts">
import { NTag, NProgress, NImage, NButton } from 'naive-ui'
import type { Take } from '@dreamer/shared/types'

defineProps<{
  task: Take
}>()

const emit = defineEmits<{
  select: []
  preview: []
}>()
</script>

<template>
  <div
    :class="['task-item', { selected: task.isSelected, processing: task.status === 'processing' }]"
  >
    <div class="task-item__info">
      <NTag :type="task.model === 'wan2.6' ? 'info' : 'warning'" size="small">
        {{ task.model === 'wan2.6' ? 'Wan 2.6' : 'Seedance' }}
      </NTag>
      <NTag v-if="task.isSelected" size="small" type="success">已选中</NTag>
      <span v-if="task.status === 'completed'" class="task-cost">
        ${{ task.cost?.toFixed(2) }}
      </span>
    </div>

    <!-- Processing Progress -->
    <div v-if="task.status === 'processing'" class="task-item__progress">
      <NProgress type="line" :percentage="50" :show-indicator="false" />
    </div>

    <!-- Thumbnail -->
    <div
      v-if="task.status === 'completed'"
      class="task-item__thumbnail"
      @click="task.videoUrl && emit('preview')"
    >
      <NImage
        v-if="task.thumbnailUrl"
        :src="task.thumbnailUrl"
        width="80"
        height="45"
        object-fit="cover"
        preview-disabled
      />
      <div v-else class="thumbnail-placeholder">预览</div>
    </div>

    <!-- Select Button -->
    <div v-if="task.status === 'completed'" class="task-item__action">
      <NButton v-if="!task.isSelected" size="small" @click="emit('select')"> 选中 </NButton>
    </div>
  </div>
</template>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  transition: all var(--transition-fast);
}

.task-item.selected {
  border-color: var(--color-success);
  background: var(--color-success-light);
}

.task-item.processing {
  background: var(--color-warning-light);
}

.task-item__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.task-cost {
  font-size: var(--font-size-xs);
  color: var(--color-success);
  font-weight: var(--font-weight-medium);
}

.task-item__progress {
  width: 60px;
}

.task-item__thumbnail {
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
}

.thumbnail-placeholder {
  width: 80px;
  height: 45px;
  background: var(--color-bg-gray);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.task-item__action {
  margin-left: auto;
}
</style>
