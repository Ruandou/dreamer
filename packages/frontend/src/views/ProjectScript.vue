<script setup lang="ts">
import { NButton, NSpace } from 'naive-ui'
import { useProjectScript } from '@/composables/useProjectScript'
import ScriptEpisodeSidebar from '@/components/script/ScriptEpisodeSidebar.vue'
import ScriptContentEditor from '@/components/script/ScriptContentEditor.vue'
import CreateEpisodeModal from '@/components/script/CreateEpisodeModal.vue'
import ExpandScriptModal from '@/components/script/ExpandScriptModal.vue'
import ImportScriptModal from '@/components/script/ImportScriptModal.vue'

const {
  episodeStore,
  showCreateModal,
  showExpandModal,
  showImportModal,
  newEpisode,
  summary,
  importContent,
  isImporting,
  selectedEpisodeId,
  isAutoSaving,
  lastSaved,
  script,
  hasEpisodes,
  currentEpisodeTitle,
  handleCreateEpisode,
  handleSelectEpisode,
  handleExpandScript,
  handleSaveScript,
  handleImportScript,
  handleFileChange,
  updateEpisodeTitle
} = useProjectScript()
</script>

<template>
  <div class="script-page">
    <!-- Header -->
    <header class="script-header">
      <div class="script-header__left">
        <h2 class="script-header__title">AI编剧</h2>
        <span v-if="hasEpisodes" class="script-header__count">
          {{ episodeStore.episodes.length }} 集
        </span>
      </div>
      <div class="script-header__right">
        <NSpace>
          <NButton @click="showImportModal = true">
            <template #icon>📥</template>
            导入文档
          </NButton>
          <NButton @click="showCreateModal = true">
            <template #icon>+</template>
            新建剧本
          </NButton>
          <NButton type="primary" @click="showExpandModal = true" :disabled="!selectedEpisodeId">
            <template #icon>✨</template>
            AI扩写
          </NButton>
        </NSpace>
      </div>
    </header>

    <!-- Main Content -->
    <div class="script-layout">
      <ScriptEpisodeSidebar
        :episodes="episodeStore.episodes"
        :selected-episode-id="selectedEpisodeId"
        @select="handleSelectEpisode"
        @create="showCreateModal = true"
      />

      <ScriptContentEditor
        :selected-episode-id="selectedEpisodeId"
        :is-loading="episodeStore.isLoading"
        :script="script"
        :current-episode-title="currentEpisodeTitle"
        :is-auto-saving="isAutoSaving"
        :last-saved="lastSaved"
        @update:title="updateEpisodeTitle"
        @save="handleSaveScript"
        @expand="showExpandModal = true"
      />
    </div>

    <!-- Modals -->
    <CreateEpisodeModal
      v-model:show="showCreateModal"
      :episode-num="newEpisode.episodeNum"
      :title="newEpisode.title"
      @update:episode-num="newEpisode.episodeNum = $event"
      @update:title="newEpisode.title = $event"
      @confirm="handleCreateEpisode"
    />

    <ExpandScriptModal
      v-model:show="showExpandModal"
      v-model:summary="summary"
      :loading="episodeStore.isExpanding"
      @confirm="handleExpandScript"
    />

    <ImportScriptModal
      v-model:show="showImportModal"
      v-model:content="importContent"
      :loading="isImporting"
      @file-change="handleFileChange"
      @confirm="handleImportScript"
    />
  </div>
</template>

<style scoped>
.script-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.script-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.script-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.script-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.script-header__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-gray);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
}

.script-layout {
  display: flex;
  gap: var(--spacing-lg);
  flex: 1;
  min-height: 0;
}
</style>
