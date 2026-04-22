<template>
  <div class="conversation-sidebar">
    <div class="sidebar-header">
      <NButton type="primary" secondary block size="small" @click="$emit('new')">
        + 新对话
      </NButton>
    </div>

    <NScrollbar class="conversation-list">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        :class="['conversation-item', { active: conv.id === activeId }]"
        @click="$emit('select', conv.id)"
      >
        <span class="conversation-title">{{ conv.title }}</span>
        <NButton text size="tiny" class="delete-btn" @click.stop="$emit('delete', conv.id)">
          ×
        </NButton>
      </div>

      <div v-if="conversations.length === 0" class="empty-hint">暂无对话，点击"新对话"开始</div>
    </NScrollbar>
  </div>
</template>

<script setup lang="ts">
import { NButton, NScrollbar } from 'naive-ui'
import type { ChatConversation } from '@dreamer/shared/types'

defineProps<{
  conversations: ChatConversation[]
  activeId: string | null
}>()

defineEmits<{
  (e: 'new'): void
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
}>()
</script>

<style scoped>
.conversation-sidebar {
  width: 200px;
  border-right: 1px solid var(--color-border-light, #e5e7eb);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-white, #fff);
}

.sidebar-header {
  padding: 8px;
}

.conversation-list {
  flex: 1;
  overflow: hidden;
}

.conversation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

.conversation-item:hover {
  background: var(--color-bg-secondary, #f3f4f6);
}

.conversation-item.active {
  background: var(--color-bg-secondary, #f3f4f6);
  border-left-color: var(--color-primary, #6366f1);
}

.conversation-title {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 16px;
}

.conversation-item:hover .delete-btn {
  opacity: 1;
}

.empty-hint {
  padding: 24px 12px;
  text-align: center;
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 13px;
}
</style>
