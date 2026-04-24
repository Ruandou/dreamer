<script setup lang="ts">
import { onMounted } from 'vue'
import { NAlert, NButton, NScrollbar } from 'naive-ui'
import EmptyState from '@/components/EmptyState.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import StoryboardHeader from '@/components/storyboard/StoryboardHeader.vue'
import SceneCard from '@/components/storyboard/SceneCard.vue'
import CharacterRefsPanel from '@/components/storyboard/CharacterRefsPanel.vue'
import CreateSceneModal from '@/components/storyboard/CreateSceneModal.vue'
import EditSceneModal from '@/components/storyboard/EditSceneModal.vue'
import { useStoryboard } from '@/composables/useStoryboard'

const {
  currentEpisodeId,
  showCreateModal,
  showEditorModal,
  editingScene,
  selectedModel,
  selectedReferenceImage,
  isTrialMode,
  selectedScenes,
  showVideoPreview,
  previewVideoUrl,
  previewThumbnailUrl,
  pollingTasks,
  episodeSelectOptions,
  sceneStore,
  characterStore,
  goBack,
  onEpisodeSelect,
  loadScenesForEpisode,
  handleCreateScene,
  handleEditScene,
  handleSaveScene,
  handleOptimizePrompt,
  handleGenerate,
  handleSelectTask,
  handlePreviewVideo,
  handleDeleteScene,
  toggleSceneSelection,
  toggleSelectAll,
  handleBatchAction,
  handleDragStart,
  handleDrop
} = useStoryboard()

onMounted(async () => {
  await loadScenesForEpisode(currentEpisodeId.value!)
})
</script>

<template>
  <div class="storyboard-page">
    <!-- Header -->
    <StoryboardHeader
      :episode-options="episodeSelectOptions"
      :current-episode-id="currentEpisodeId"
      :selected-model="selectedModel"
      :is-trial-mode="isTrialMode"
      :selected-count="selectedScenes.size"
      :total-count="sceneStore.scenes.length"
      :has-scenes="sceneStore.scenes.length > 0"
      @back="goBack"
      @update:episode="onEpisodeSelect"
      @update:model="(v) => (selectedModel = v)"
      @update:trial-mode="(v) => (isTrialMode = v)"
      @update:select-all="toggleSelectAll"
      @batch-action="handleBatchAction"
      @add-scene="showCreateModal = true"
    />

    <!-- Task Alert -->
    <NAlert v-if="pollingTasks.size > 0" type="info" class="task-alert">
      <template #icon>🎬</template>
      正在进行 {{ pollingTasks.size }} 个视频生成任务，请在下方查看进度
    </NAlert>

    <!-- Content -->
    <div class="storyboard-content">
      <!-- Empty State -->
      <EmptyState
        v-if="sceneStore.scenes.length === 0"
        title="暂无分镜"
        description="从剧本页面创建场景，或在此手动添加分镜"
        icon="🎬"
      >
        <template #action>
          <NButton type="primary" @click="showCreateModal = true"> 添加第一个分镜 </NButton>
        </template>
      </EmptyState>

      <!-- Scenes List -->
      <div v-else class="scenes-list">
        <NScrollbar>
          <SceneCard
            v-for="(scene, index) in sceneStore.scenes"
            :key="scene.id"
            :scene="scene"
            :index="index"
            :is-selected="selectedScenes.has(scene.id)"
            @edit="handleEditScene"
            @generate="handleGenerate"
            @delete="handleDeleteScene"
            @select-task="handleSelectTask"
            @preview-video="handlePreviewVideo"
            @toggle-selection="toggleSceneSelection"
            @drag-start="handleDragStart"
            @drop="handleDrop"
          />
        </NScrollbar>
      </div>

      <!-- Character Reference -->
      <CharacterRefsPanel
        v-if="characterStore.characters.length > 0"
        :characters="characterStore.characters"
        v-model:selected-image="selectedReferenceImage"
      />
    </div>

    <!-- Create Scene Modal -->
    <CreateSceneModal v-model:show="showCreateModal" @create="handleCreateScene" />

    <!-- Edit Scene Modal -->
    <EditSceneModal
      v-model:show="showEditorModal"
      :scene="editingScene"
      :is-generating="sceneStore.isGenerating"
      @save="handleSaveScene"
      @optimize-prompt="handleOptimizePrompt"
    />

    <!-- Video Preview -->
    <VideoPlayer
      v-model:show="showVideoPreview"
      :video-url="previewVideoUrl"
      :thumbnail-url="previewThumbnailUrl"
    />
  </div>
</template>

<style scoped>
.storyboard-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.task-alert {
  margin-bottom: var(--spacing-lg);
}

.storyboard-content {
  flex: 1;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.scenes-list {
  flex: 1;
  min-height: 0;
}
</style>
