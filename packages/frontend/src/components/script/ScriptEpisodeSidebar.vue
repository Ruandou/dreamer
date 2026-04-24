<script setup lang="ts">
import { NTag, NScrollbar, NButton } from 'naive-ui'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

interface Episode {
  id: string
  episodeNum: number
  title?: string | null
  script?: unknown
}

interface Props {
  episodes: Episode[]
  selectedEpisodeId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  select: [episodeId: string]
  create: []
}>()
</script>

<template>
  <aside class="episode-sidebar">
    <div class="episode-sidebar__header">
      <span>剧本列表</span>
      <NTag size="small" round>{{ episodes.length }}</NTag>
    </div>

    <NScrollbar v-if="episodes.length" class="episode-scrollbar">
      <div
        v-for="episode in episodes"
        :key="episode.id"
        :class="['episode-item', { active: selectedEpisodeId === episode.id }]"
        @click="emit('select', episode.id)"
      >
        <div class="episode-item__main">
          <span class="episode-item__title">
            {{ episode.title || `第${episode.episodeNum}集` }}
          </span>
          <span class="episode-item__num">#{{ episode.episodeNum }}</span>
        </div>
        <div class="episode-item__status">
          <StatusBadge :status="episode.script ? 'completed' : 'draft'" size="small" />
        </div>
      </div>
    </NScrollbar>

    <EmptyState v-else title="暂无剧本" description="创建第一集开始创作" icon="">
      <template #action>
        <NButton size="small" type="primary" @click="emit('create')"> 新建剧本 </NButton>
      </template>
    </EmptyState>
  </aside>
</template>

<style scoped>
.episode-sidebar {
  width: 240px;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.episode-sidebar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.episode-scrollbar {
  flex: 1;
}

.episode-item {
  padding: var(--spacing-md);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-light);
  transition: all var(--transition-fast);
}

.episode-item:hover {
  background: var(--color-bg-gray);
}

.episode-item.active {
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
}

.episode-item__main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.episode-item__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.episode-item__num {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-left: var(--spacing-sm);
}

.episode-item__status {
  display: flex;
  justify-content: flex-start;
}
</style>
