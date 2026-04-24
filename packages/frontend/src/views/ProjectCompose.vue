<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useCompositionStore } from '@/stores/composition'
import { useSceneStore } from '@/stores/scene'
import { useEpisodeStore } from '@/stores/episode'
import VideoPlayer from '@/components/VideoPlayer.vue'
import { useComposeTimeline } from '@/composables/useComposeTimeline'
import ComposeHeader from '@/components/compose/ComposeHeader.vue'
import CompositionList from '@/components/compose/CompositionList.vue'
import TimelinePanel from '@/components/compose/TimelinePanel.vue'
import SegmentSources from '@/components/compose/SegmentSources.vue'
import CreateCompositionModal from '@/components/compose/CreateCompositionModal.vue'

const route = useRoute()
const message = useMessage()
const compositionStore = useCompositionStore()
const sceneStore = useSceneStore()
const episodeStore = useEpisodeStore()

const projectId = computed(() => route.params.id as string)

const showCreateModal = ref(false)
const showPreview = ref(false)
const previewUrl = ref<string | undefined>()

const {
  timelineSegments,
  availableSegments,
  totalDuration,
  handleSelectComposition,
  addToTimeline,
  removeFromTimeline,
  handleDragStart,
  handleDrop,
  handleDragOver,
  saveTimeline,
  handleExport,
  formatTime
} = useComposeTimeline()

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
  if (episodeStore.episodes.length > 0) {
    await sceneStore.fetchScenes(episodeStore.episodes[0].id)
  }
  await compositionStore.fetchCompositions(projectId.value)
})

const handleCreateComposition = async (title: string) => {
  if (!title.trim()) {
    message.warning('请输入作品标题')
    return
  }
  const ep = episodeStore.episodes[0]
  if (!ep) {
    message.warning('请先创建剧集')
    return
  }
  await compositionStore.createComposition(projectId.value, ep.id, title)
  message.success('合成创建成功')
}

const handlePreviewComposition = () => {
  if (compositionStore.currentComposition?.outputUrl) {
    previewUrl.value = compositionStore.currentComposition.outputUrl
    showPreview.value = true
  }
}

const handleCreateClick = () => {
  showCreateModal.value = true
}
</script>

<template>
  <div class="compose-page">
    <!-- Header -->
    <ComposeHeader
      :total-duration="totalDuration"
      :format-time="formatTime"
      @create-composition="handleCreateClick"
      @export="handleExport"
    />

    <!-- Content -->
    <div class="compose-content">
      <div class="compose-layout">
        <!-- Composition List Sidebar -->
        <CompositionList
          :compositions="compositionStore.compositions"
          :current-composition="compositionStore.currentComposition"
          @select="handleSelectComposition"
        />

        <!-- Main Editor -->
        <TimelinePanel
          :current-composition="compositionStore.currentComposition"
          :timeline-segments="timelineSegments"
          :total-duration="totalDuration"
          :format-time="formatTime"
          @dragstart="handleDragStart"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @remove="removeFromTimeline"
          @save="saveTimeline"
          @preview="handlePreviewComposition"
        />

        <!-- Available Segments Sidebar -->
        <SegmentSources :segments="availableSegments" @add="addToTimeline" />
      </div>
    </div>

    <!-- Create Modal -->
    <CreateCompositionModal v-model:show="showCreateModal" @create="handleCreateComposition" />

    <!-- Video Preview -->
    <VideoPlayer v-model:show="showPreview" :video-url="previewUrl" />
  </div>
</template>

<style scoped>
.compose-page {
  display: flex;
  flex-direction: column;
}

.compose-content {
  flex: 1;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  min-height: 0;
}

.compose-layout {
  display: flex;
  gap: var(--spacing-lg);
  height: 100%;
}
</style>
