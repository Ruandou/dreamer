<script setup lang="ts">
defineProps<{
  status: 'draft' | 'processing' | 'completed' | 'failed' | 'pending' | 'queued' | 'generating'
  size?: 'small' | 'medium'
}>()

const statusConfig = {
  draft: { label: '草稿', color: '#6b7280', bg: '#f3f4f6' },
  pending: { label: '等待中', color: '#6b7280', bg: '#f3f4f6' },
  queued: { label: '队列中', color: '#3b82f6', bg: '#dbeafe' },
  generating: { label: '生成中', color: '#3b82f6', bg: '#dbeafe' },
  processing: { label: '制作中', color: '#3b82f6', bg: '#dbeafe' },
  completed: { label: '已完成', color: '#10b981', bg: '#d1fae5' },
  failed: { label: '失败', color: '#ef4444', bg: '#fee2e2' },
}

const getConfig = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
}
</script>

<template>
  <span
    class="status-badge"
    :class="[`status-badge--${size || 'small'}`]"
    :style="{
      color: getConfig(status).color,
      backgroundColor: getConfig(status).bg,
    }"
  >
    <span class="status-badge__dot" :style="{ backgroundColor: getConfig(status).color }"></span>
    {{ getConfig(status).label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.status-badge--medium {
  padding: 6px 14px;
  font-size: var(--font-size-sm);
}

.status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-badge--medium .status-badge__dot {
  width: 8px;
  height: 8px;
}
</style>
