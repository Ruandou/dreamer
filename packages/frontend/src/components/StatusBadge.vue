<script setup lang="ts">
defineProps<{
  status: 'draft' | 'processing' | 'completed' | 'failed' | 'pending' | 'queued' | 'generating'
  size?: 'small' | 'medium'
}>()

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'status-badge--draft' },
  pending: { label: '等待中', cls: 'status-badge--draft' },
  queued: { label: '队列中', cls: 'status-badge--info' },
  generating: { label: '生成中', cls: 'status-badge--info' },
  processing: { label: '制作中', cls: 'status-badge--info' },
  completed: { label: '已完成', cls: 'status-badge--success' },
  failed: { label: '失败', cls: 'status-badge--error' }
}

function getConfig(status: string) {
  return statusConfig[status] || statusConfig.draft
}
</script>

<template>
  <span class="status-badge" :class="[`status-badge--${size || 'small'}`, getConfig(status).cls]">
    <span class="status-badge__dot"></span>
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

.status-badge--small {
  padding: 4px 10px;
  font-size: var(--font-size-xs);
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

/* 状态颜色 - 使用 CSS 变量 */
.status-badge--draft {
  color: var(--color-text-secondary);
  background: var(--color-bg-gray);
}
.status-badge--draft .status-badge__dot {
  background-color: var(--color-text-secondary);
}

.status-badge--info {
  color: var(--color-info);
  background: var(--color-info-light);
}
.status-badge--info .status-badge__dot {
  background-color: var(--color-info);
}

.status-badge--success {
  color: var(--color-success);
  background: var(--color-success-light);
}
.status-badge--success .status-badge__dot {
  background-color: var(--color-success);
}

.status-badge--error {
  color: var(--color-error);
  background: var(--color-error-light);
}
.status-badge--error .status-badge__dot {
  background-color: var(--color-error);
}
</style>
