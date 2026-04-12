<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NButton, NSpace, NModal, NForm, NFormItem, NInput,
  NImage, NAlert, NScrollbar, useMessage
} from 'naive-ui'
import { useCompositionStore } from '@/stores/composition'
import { useSceneStore } from '@/stores/scene'
import { useEpisodeStore } from '@/stores/episode'
import VideoPlayer from '@/components/VideoPlayer.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const route = useRoute()
const message = useMessage()
const compositionStore = useCompositionStore()
const sceneStore = useSceneStore()
const episodeStore = useEpisodeStore()

const projectId = computed(() => route.params.id as string)

const showCreateModal = ref(false)
const showPreview = ref(false)
const previewUrl = ref<string | undefined>()
const newComposition = ref({ title: '' })

// 已选用 Take 的场次，可加入成片时间轴
const availableSegments = computed(() => {
  const segments: any[] = []
  sceneStore.scenes.forEach(scene => {
    if (scene.status === 'completed' && scene.takes?.length) {
      const selectedTask = scene.takes.find((t) => t.isSelected && t.videoUrl)
      if (selectedTask) {
        segments.push({
          sceneId: scene.id,
          takeId: selectedTask.id,
          sceneNum: scene.sceneNum,
          description: scene.description,
          videoUrl: selectedTask.videoUrl,
          thumbnailUrl: selectedTask.thumbnailUrl,
          duration: selectedTask.duration || 5
        })
      }
    }
  })
  return segments
})

// Timeline state
const timelineSegments = ref<any[]>([])
const totalDuration = computed(() =>
  timelineSegments.value.reduce((sum, seg) => sum + (Number(seg.duration) || 5), 0)
)

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
  if (episodeStore.episodes.length > 0) {
    await sceneStore.fetchScenes(episodeStore.episodes[0].id)
  }
  await compositionStore.fetchCompositions(projectId.value)
})

const handleCreateComposition = async () => {
  if (!newComposition.value.title.trim()) {
    message.warning('请输入作品标题')
    return
  }
  const ep = episodeStore.episodes[0]
  if (!ep) {
    message.warning('请先创建剧集')
    return
  }
  await compositionStore.createComposition(projectId.value, ep.id, newComposition.value.title)
  showCreateModal.value = false
  newComposition.value = { title: '' }
  message.success('合成创建成功')
}

const handleSelectComposition = async (composition: any) => {
  await compositionStore.getComposition(composition.id)
  const comp: any = compositionStore.currentComposition
  if (comp?.scenes?.length) {
    timelineSegments.value = comp.scenes.map((row: any) => ({
      sceneId: row.sceneId,
      takeId: row.takeId,
      order: row.order,
      duration: row.take?.duration || 5,
      videoUrl: row.videoUrl,
      thumbnailUrl: row.thumbnailUrl,
      startTime: 0,
      endTime: 5
    }))
  } else {
    timelineSegments.value = []
  }
}

const addToTimeline = (segment: any) => {
  const lastEndTime = timelineSegments.value.reduce(
    (max, seg) => Math.max(max, seg.endTime),
    0
  )
  timelineSegments.value.push({
    sceneId: segment.sceneId,
    takeId: segment.takeId,
    order: timelineSegments.value.length,
    duration: segment.duration || 5,
    startTime: lastEndTime,
    endTime: lastEndTime + (segment.duration || 5),
    videoUrl: segment.videoUrl,
    thumbnailUrl: segment.thumbnailUrl
  })
  message.success('已添加到时间轴')
}

const removeFromTimeline = (index: number) => {
  timelineSegments.value.splice(index, 1)
  timelineSegments.value.forEach((seg, i) => {
    seg.order = i
  })
}

const moveSegment = (fromIndex: number, toIndex: number) => {
  const [removed] = timelineSegments.value.splice(fromIndex, 1)
  timelineSegments.value.splice(toIndex, 0, removed)
  timelineSegments.value.forEach((seg, i) => {
    seg.order = i
  })
}

const handleDragStart = (e: DragEvent, index: number) => {
  (e.dataTransfer as DataTransfer).setData('text/plain', index.toString())
}

const handleDrop = (e: DragEvent, targetIndex: number) => {
  e.preventDefault()
  const fromIndex = parseInt((e.dataTransfer as DataTransfer).getData('text/plain'))
  moveSegment(fromIndex, targetIndex)
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const saveTimeline = async () => {
  if (!compositionStore.currentComposition) return
  await compositionStore.updateTimeline(
    compositionStore.currentComposition.id,
    timelineSegments.value.map((seg, i) => ({
      sceneId: seg.sceneId,
      takeId: seg.takeId,
      order: i
    }))
  )
  message.success('时间轴已保存')
}

const handleExport = async () => {
  if (!compositionStore.currentComposition) return
  await saveTimeline()
  await compositionStore.triggerExport(compositionStore.currentComposition.id)
  message.info('视频导出中...')
}

const handlePreviewComposition = () => {
  if (compositionStore.currentComposition?.outputUrl) {
    previewUrl.value = compositionStore.currentComposition.outputUrl
    showPreview.value = true
  }
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="compose-page">
    <!-- Header -->
    <header class="compose-header">
      <div class="compose-header__left">
        <h2 class="compose-header__title">视频合成</h2>
        <span class="compose-header__duration" v-if="totalDuration > 0">
          总时长 {{ formatTime(totalDuration) }}
        </span>
      </div>
      <div class="compose-header__right">
        <NButton @click="showCreateModal = true">
          <template #icon>+</template>
          新建合成
        </NButton>
        <NButton
          v-if="compositionStore.currentComposition"
          type="primary"
          :loading="compositionStore.isExporting"
          @click="handleExport"
        >
          导出视频
        </NButton>
      </div>
    </header>

    <!-- Content -->
    <div class="compose-content">
      <div class="compose-layout">
        <!-- Composition List Sidebar -->
        <aside class="compose-sidebar">
          <div class="sidebar-header">
            <span>合成作品</span>
          </div>
          <NScrollbar>
            <div v-if="compositionStore.compositions.length === 0" class="sidebar-empty">
              暂无合成
            </div>
            <div
              v-for="comp in compositionStore.compositions"
              :key="comp.id"
              :class="['composition-item', { active: compositionStore.currentComposition?.id === comp.id }]"
              @click="handleSelectComposition(comp)"
            >
              <span class="composition-item__title">{{ comp.title }}</span>
              <StatusBadge :status="comp.status === 'completed' ? 'completed' : comp.status === 'processing' ? 'processing' : 'draft'" size="small" />
            </div>
          </NScrollbar>
        </aside>

        <!-- Main Editor -->
        <main class="compose-main">
          <EmptyState
            v-if="!compositionStore.currentComposition"
            title="选择或创建合成"
            description="从左侧选择一个合成作品，或创建新的合成"
            icon="🎞️"
          >
            <template #action>
              <NButton type="primary" @click="showCreateModal = true">
                新建合成
              </NButton>
            </template>
          </EmptyState>

          <div v-else class="composition-editor">
            <!-- Timeline Section -->
            <section class="editor-section">
              <div class="editor-section__header">
                <h4 class="editor-section__title">
                  <span>🎬</span> 时间轴
                </h4>
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
                  @dragstart="handleDragStart($event, index)"
                  @drop="handleDrop($event, index)"
                  @dragover="handleDragOver"
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
                    <NButton size="tiny" quaternary @click="removeFromTimeline(index)">
                      ✕
                    </NButton>
                  </div>
                </div>
              </div>

              <div class="editor-section__footer">
                <NButton size="small" @click="saveTimeline">保存时间轴</NButton>
              </div>
            </section>

            <!-- Export Section -->
            <section v-if="compositionStore.currentComposition.outputUrl" class="editor-section">
              <h4 class="editor-section__title">🎉 成品预览</h4>
              <NButton type="primary" @click="handlePreviewComposition">
                预览导出视频
              </NButton>
            </section>

            <!-- Exporting Alert -->
            <NAlert v-if="compositionStore.currentComposition.status === 'processing'" type="warning">
              视频正在拼接导出中，请稍候...
            </NAlert>
          </div>
        </main>

        <!-- Available Segments Sidebar -->
        <aside class="compose-sidebar">
          <div class="sidebar-header">
            <span>可用分镜</span>
          </div>
          <NScrollbar>
            <div v-if="availableSegments.length === 0" class="sidebar-empty">
              暂无可用分镜
            </div>
            <div
              v-for="segment in availableSegments"
              :key="segment.sceneId"
              class="segment-source"
              draggable="true"
              @dragstart="(e) => {
                (e.dataTransfer as DataTransfer).setData('application/json', JSON.stringify(segment))
                ;(e.dataTransfer as DataTransfer).effectAllowed = 'copy'
              }"
            >
              <div class="segment-source__thumb">
                <NImage
                  v-if="segment.thumbnailUrl"
                  :src="segment.thumbnailUrl"
                  width="60"
                  height="34"
                  object-fit="cover"
                  preview-disabled
                />
                <div v-else class="thumb-placeholder">预览</div>
              </div>
              <div class="segment-source__info">
                <span class="segment-source__title">#{{ segment.sceneNum }}</span>
                <span class="segment-source__duration">{{ segment.duration }}秒</span>
              </div>
              <NButton size="tiny" @click="addToTimeline(segment)">+</NButton>
            </div>
          </NScrollbar>
        </aside>
      </div>
    </div>

    <!-- Create Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="新建合成"
      style="width: 400px"
    >
      <NForm :model="newComposition" label-placement="top">
        <NFormItem label="作品标题" path="title">
          <NInput
            v-model:value="newComposition.title"
            placeholder="给合成作品起个名字"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateComposition">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Video Preview -->
    <VideoPlayer
      v-model:show="showPreview"
      :video-url="previewUrl"
    />
  </div>
</template>

<style scoped>
.compose-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.compose-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.compose-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.compose-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.compose-header__duration {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-gray);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
}

.compose-header__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

/* Sidebars */
.compose-sidebar {
  width: 200px;
  background: var(--color-bg-gray);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: var(--spacing-md);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
}

.sidebar-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.composition-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-light);
  transition: all var(--transition-fast);
}

.composition-item:hover {
  background: var(--color-bg-white);
}

.composition-item.active {
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
}

.composition-item__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* Main Editor */
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

/* Timeline */
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

/* Audio Items */
.audio-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.audio-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.audio-item__label {
  width: 80px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Segment Sources */
.segment-source {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
  cursor: grab;
  transition: all var(--transition-fast);
}

.segment-source:hover {
  background: var(--color-bg-white);
}

.segment-source__thumb {
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.segment-source__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.segment-source__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.segment-source__duration {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
