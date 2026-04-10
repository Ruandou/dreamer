<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput, NImage, NTag, NProgress, NAlert, NUpload, NSelect } from 'naive-ui'
import type { UploadFile } from 'naive-ui'
import { useCompositionStore } from '@/stores/composition'
import { useSceneStore } from '@/stores/scene'
import { useEpisodeStore } from '@/stores/episode'
import VideoPlayer from '@/components/VideoPlayer.vue'

const route = useRoute()
const compositionStore = useCompositionStore()
const sceneStore = useSceneStore()
const episodeStore = useEpisodeStore()

const projectId = computed(() => route.params.id as string)

const showCreateModal = ref(false)
const showPreview = ref(false)
const previewUrl = ref<string | undefined>()
const newComposition = ref({ title: '' })

// Available segments from completed scenes
const availableSegments = computed(() => {
  const segments: any[] = []
  sceneStore.scenes.forEach(scene => {
    if (scene.status === 'completed' && scene.tasks) {
      const selectedTask = scene.tasks.find(t => t.isSelected && t.videoUrl)
      if (selectedTask) {
        segments.push({
          sceneId: scene.id,
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
const currentTime = ref(0)
const totalDuration = computed(() =>
  timelineSegments.value.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0)
)

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
  if (episodeStore.episodes.length > 0) {
    await sceneStore.fetchScenes(episodeStore.episodes[0].id)
  }
  await compositionStore.fetchCompositions(projectId.value)
})

const handleCreateComposition = async () => {
  await compositionStore.createComposition(projectId.value, newComposition.value.title)
  showCreateModal.value = false
  newComposition.value = { title: '' }
}

const handleSelectComposition = async (composition: any) => {
  await compositionStore.getComposition(composition.id)
  if (compositionStore.currentComposition?.segments) {
    timelineSegments.value = compositionStore.currentComposition.segments.map((seg: any) => ({
      sceneId: seg.sceneId,
      order: seg.order,
      startTime: seg.startTime || 0,
      endTime: seg.endTime || 5,
      transition: seg.transition || 'none',
      videoUrl: seg.videoUrl,
      thumbnailUrl: seg.thumbnailUrl
    }))
  }
}

const addToTimeline = (segment: any) => {
  const lastEndTime = timelineSegments.value.reduce(
    (max, seg) => Math.max(max, seg.endTime),
    0
  )
  timelineSegments.value.push({
    sceneId: segment.sceneId,
    order: timelineSegments.value.length,
    startTime: lastEndTime,
    endTime: lastEndTime + (segment.duration || 5),
    transition: 'none',
    videoUrl: segment.videoUrl,
    thumbnailUrl: segment.thumbnailUrl
  })
}

const removeFromTimeline = (index: number) => {
  timelineSegments.value.splice(index, 1)
  // Update order
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
    timelineSegments.value.map(seg => ({
      sceneId: seg.sceneId,
      order: seg.order,
      startTime: seg.startTime,
      endTime: seg.endTime,
      transition: seg.transition
    }))
  )
}

const handleUploadAudio = async (type: 'voiceover' | 'bgm', file: File) => {
  if (!compositionStore.currentComposition) return
  await compositionStore.uploadAudio(compositionStore.currentComposition.id, type, file)
}

const handleUploadSubtitles = async (file: File) => {
  if (!compositionStore.currentComposition) return
  await compositionStore.uploadSubtitles(compositionStore.currentComposition.id, file)
}

const handleExport = async () => {
  if (!compositionStore.currentComposition) return
  await saveTimeline()
  await compositionStore.triggerExport(compositionStore.currentComposition.id)
}

const handlePreviewComposition = () => {
  if (compositionStore.currentComposition?.outputUrl) {
    previewUrl.value = compositionStore.currentComposition.outputUrl
    showPreview.value = true
  }
}

const getStatusType = (status: string) => {
  switch (status) {
    case 'exported': return 'success'
    case 'exporting': return 'warning'
    default: return 'default'
  }
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="compose-container">
    <NCard title="视频合成">
      <template #header-extra>
        <NSpace>
          <NButton @click="showCreateModal = true">新建合成</NButton>
          <NButton
            v-if="compositionStore.currentComposition"
            type="primary"
            :loading="compositionStore.isExporting"
            @click="handleExport"
          >
            导出视频
          </NButton>
        </NSpace>
      </template>

      <div class="compose-layout">
        <!-- Composition List -->
        <div class="composition-list">
          <div class="list-header">合成作品</div>
          <div v-if="compositionStore.compositions.length === 0" class="empty-list">
            暂无合成
          </div>
          <div
            v-for="comp in compositionStore.compositions"
            :key="comp.id"
            :class="['composition-item', { active: compositionStore.currentComposition?.id === comp.id }]"
            @click="handleSelectComposition(comp)"
          >
            <span class="comp-title">{{ comp.title }}</span>
            <NTag :type="getStatusType(comp.status)" size="tiny">
              {{ comp.status === 'exported' ? '已导出' : comp.status === 'exporting' ? '导出中' : '草稿' }}
            </NTag>
          </div>
        </div>

        <!-- Main Area -->
        <div class="compose-main">
          <div v-if="!compositionStore.currentComposition" class="no-composition">
            <NEmpty description="请选择或创建一个合成作品">
              <template #extra>
                <NButton type="primary" @click="showCreateModal = true">新建合成</NButton>
              </template>
            </NEmpty>
          </div>

          <div v-else class="composition-editor">
            <!-- Timeline Section -->
            <div class="timeline-section">
              <div class="section-header">
                <span>时间轴</span>
                <span class="duration">{{ formatTime(totalDuration) }}</span>
              </div>

              <div class="timeline-content">
                <div v-if="timelineSegments.length === 0" class="timeline-empty">
                  从左侧拖拽分镜片段到此处
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
                  <div class="segment-thumbnail">
                    <NImage
                      v-if="segment.thumbnailUrl"
                      :src="segment.thumbnailUrl"
                      width="80"
                      height="45"
                      object-fit="cover"
                    />
                    <div v-else class="thumb-placeholder">预览</div>
                  </div>
                  <div class="segment-info">
                    <span class="segment-title">片段 {{ index + 1 }}</span>
                    <span class="segment-time">
                      {{ formatTime(segment.startTime) }} - {{ formatTime(segment.endTime) }}
                    </span>
                  </div>
                  <div class="segment-actions">
                    <NButton size="tiny" @click="removeFromTimeline(index)">移除</NButton>
                  </div>
                </div>
              </div>

              <div class="timeline-footer">
                <NButton size="small" @click="saveTimeline">保存时间轴</NButton>
              </div>
            </div>

            <!-- Audio Section -->
            <div class="audio-section">
              <div class="section-header">音频</div>
              <div class="audio-items">
                <div class="audio-item">
                  <span>配音</span>
                  <NUpload
                    accept="audio/*"
                    :show-file-list="false"
                    @change="(opt: any) => handleUploadAudio('voiceover', opt.file.file)"
                  >
                    <NButton size="small">
                      {{ compositionStore.currentComposition.voiceover ? '替换' : '上传' }}
                    </NButton>
                  </NUpload>
                  <span v-if="compositionStore.currentComposition.voiceover" class="audio-loaded">已上传</span>
                </div>
                <div class="audio-item">
                  <span>背景音乐</span>
                  <NUpload
                    accept="audio/*"
                    :show-file-list="false"
                    @change="(opt: any) => handleUploadAudio('bgm', opt.file.file)"
                  >
                    <NButton size="small">
                      {{ compositionStore.currentComposition.bgm ? '替换' : '上传' }}
                    </NButton>
                  </NUpload>
                  <span v-if="compositionStore.currentComposition.bgm" class="audio-loaded">已上传</span>
                </div>
                <div class="audio-item">
                  <span>字幕</span>
                  <NUpload
                    accept=".srt,.vtt"
                    :show-file-list="false"
                    @change="(opt: any) => handleUploadSubtitles(opt.file.file)"
                  >
                    <NButton size="small">
                      {{ compositionStore.currentComposition.subtitles ? '替换' : '上传' }}
                    </NButton>
                  </NUpload>
                  <span v-if="compositionStore.currentComposition.subtitles" class="audio-loaded">已上传</span>
                </div>
              </div>
            </div>

            <!-- Output Preview -->
            <div v-if="compositionStore.currentComposition.outputUrl" class="output-section">
              <div class="section-header">成品预览</div>
              <NButton type="primary" @click="handlePreviewComposition">预览导出视频</NButton>
            </div>

            <!-- Export Status -->
            <div v-if="compositionStore.currentComposition.status === 'exporting'" class="exporting-section">
              <NAlert type="warning">
                视频正在导出中，请稍候...
              </NAlert>
            </div>
          </div>
        </div>

        <!-- Available Segments -->
        <div class="available-segments">
          <div class="list-header">可用分镜</div>
          <div v-if="availableSegments.length === 0" class="empty-list">
            暂无可用的分镜片段
          </div>
          <div
            v-for="segment in availableSegments"
            :key="segment.sceneId"
            class="segment-source"
            draggable="true"
            @dragstart="(e) => { (e.dataTransfer as DataTransfer).setData('application/json', JSON.stringify(segment)); (e.dataTransfer as DataTransfer).effectAllowed = 'copy' }"
          >
            <div class="source-thumb">
              <NImage
                v-if="segment.thumbnailUrl"
                :src="segment.thumbnailUrl"
                width="60"
                height="34"
                object-fit="cover"
              />
              <div v-else class="thumb-placeholder">预览</div>
            </div>
            <div class="source-info">
              <span class="source-title">#{{ segment.sceneNum }}</span>
              <span class="source-duration">{{ segment.duration }}秒</span>
            </div>
            <NButton size="tiny" @click="addToTimeline(segment)">添加</NButton>
          </div>
        </div>
      </div>
    </NCard>

    <!-- Create Modal -->
    <NModal v-model:show="showCreateModal" preset="card" title="新建合成" style="width: 400px">
      <NForm :model="newComposition">
        <NFormItem label="作品标题" path="title">
          <NInput v-model:value="newComposition.title" placeholder="请输入作品标题" />
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
.compose-container {
  height: 100%;
}

.compose-layout {
  display: flex;
  gap: 16px;
  min-height: 500px;
}

.composition-list {
  width: 180px;
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
}

.list-header {
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.empty-list {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}

.composition-item {
  padding: 10px 8px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.composition-item:hover {
  background: #f0f0f0;
}

.composition-item.active {
  background: #e6f4ff;
}

.comp-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compose-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.no-composition {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.composition-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.duration {
  font-weight: normal;
  color: #666;
}

.timeline-section {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
}

.timeline-content {
  min-height: 100px;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-content: flex-start;
}

.timeline-empty {
  width: 100%;
  text-align: center;
  color: #999;
  padding: 24px;
}

.timeline-segment {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  cursor: grab;
  border: 1px solid #e8e8e8;
}

.timeline-segment:hover {
  border-color: #1890ff;
}

.segment-thumbnail {
  border-radius: 4px;
  overflow: hidden;
}

.thumb-placeholder {
  width: 80px;
  height: 45px;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
}

.segment-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.segment-title {
  font-weight: 500;
  font-size: 13px;
}

.segment-time {
  font-size: 11px;
  color: #666;
}

.segment-actions {
  margin-left: auto;
}

.timeline-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.audio-section {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
}

.audio-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audio-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.audio-item span:first-child {
  width: 80px;
}

.audio-loaded {
  color: #52c41a;
  font-size: 12px;
}

.output-section {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
}

.exporting-section {
  margin-top: 12px;
}

.available-segments {
  width: 200px;
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
}

.segment-source {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: grab;
}

.segment-source:hover {
  border-color: #1890ff;
}

.source-thumb {
  border-radius: 4px;
  overflow: hidden;
}

.source-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.source-title {
  font-weight: 500;
  font-size: 12px;
}

.source-duration {
  font-size: 11px;
  color: #666;
}
</style>
