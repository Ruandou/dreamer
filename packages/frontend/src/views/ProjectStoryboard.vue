<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput, NSelect, NImage, NTag, NProgress, NAlert, NSwitch, NTooltip, NBadge, NCheckbox } from 'naive-ui'
import { useSceneStore } from '@/stores/scene'
import { useEpisodeStore } from '@/stores/episode'
import { useCharacterStore } from '@/stores/character'
import VideoPlayer from '@/components/VideoPlayer.vue'
import type { Scene, VideoTask } from '@shared/types'

const route = useRoute()
const sceneStore = useSceneStore()
const episodeStore = useEpisodeStore()
const characterStore = useCharacterStore()

const projectId = computed(() => route.params.id as string)

const showCreateModal = ref(false)
const showEditorModal = ref(false)
const editingScene = ref<any>(null)
const newScene = ref({ description: '', prompt: '' })
const selectedModel = ref<'wan2.6' | 'seedance2.0'>('wan2.6')
const selectedReferenceImage = ref<string | undefined>()
const isTrialMode = ref(true) // 试错模式 vs 高光模式
const selectedScenes = ref<Set<string>>(new Set())

// Video preview
const showVideoPreview = ref(false)
const previewVideoUrl = ref<string | undefined>()
const previewThumbnailUrl = ref<string | undefined>()

// Polling state
const pollingTasks = ref<Map<string, number>>(new Map())

onMounted(async () => {
  // Get first episode for this project
  await episodeStore.fetchEpisodes(projectId.value)
  if (episodeStore.episodes.length > 0) {
    await sceneStore.fetchScenes(episodeStore.episodes[0].id)
  }
  await characterStore.fetchCharacters(projectId.value)
})

watch(() => sceneStore.scenes, (scenes) => {
  // Start polling for processing tasks
  scenes.forEach(scene => {
    if (scene.status === 'processing' && !pollingTasks.value.has(scene.id)) {
      startPolling(scene.id)
    }
  })
}, { deep: true })

const startPolling = (sceneId: string) => {
  pollingTasks.value.set(sceneId, 0)
  const poll = async () => {
    if (!pollingTasks.value.has(sceneId)) return

    await sceneStore.getScene(sceneId)
    const scene = sceneStore.currentScene

    if (scene?.status === 'completed' || scene?.status === 'failed') {
      pollingTasks.value.delete(sceneId)
      return
    }

    pollingTasks.value.set(sceneId, (pollingTasks.value.get(sceneId) || 0) + 1)
    setTimeout(poll, 3000)
  }
  setTimeout(poll, 3000)
}

const handleCreateScene = async () => {
  if (!episodeStore.episodes.length) return
  await sceneStore.createScene({
    episodeId: episodeStore.episodes[0].id,
    sceneNum: sceneStore.scenes.length + 1,
    description: newScene.value.description,
    prompt: newScene.value.prompt || newScene.value.description
  })
  showCreateModal.value = false
  newScene.value = { description: '', prompt: '' }
}

const handleEditScene = (scene: Scene) => {
  editingScene.value = { ...scene }
  showEditorModal.value = true
}

const handleSaveScene = async () => {
  if (!editingScene.value) return
  await sceneStore.updateScene(editingScene.value.id, {
    description: editingScene.value.description,
    prompt: editingScene.value.prompt
  })
  showEditorModal.value = false
}

const handleOptimizePrompt = async () => {
  if (!editingScene.value) return
  const optimized = await sceneStore.optimizePrompt(editingScene.value.id, editingScene.value.prompt)
  editingScene.value.prompt = optimized
}

const handleGenerate = async (sceneId: string) => {
  await sceneStore.generateVideo(sceneId, selectedModel.value, selectedReferenceImage.value)
  startPolling(sceneId)
}

const handleBatchGenerate = async () => {
  if (selectedScenes.value.size === 0) return
  await sceneStore.batchGenerate(
    Array.from(selectedScenes.value),
    selectedModel.value,
    selectedReferenceImage.value
  )
  Array.from(selectedScenes.value).forEach(id => startPolling(id))
}

const handleSelectTask = async (sceneId: string, taskId: string) => {
  await sceneStore.selectTask(sceneId, taskId)
}

const handlePreviewVideo = (videoUrl: string, thumbnailUrl?: string) => {
  previewVideoUrl.value = videoUrl
  previewThumbnailUrl.value = thumbnailUrl
  showVideoPreview.value = true
}

const handleDeleteScene = async (id: string) => {
  await sceneStore.deleteScene(id)
}

const toggleSceneSelection = (sceneId: string) => {
  if (selectedScenes.value.has(sceneId)) {
    selectedScenes.value.delete(sceneId)
  } else {
    selectedScenes.value.add(sceneId)
  }
  selectedScenes.value = new Set(selectedScenes.value)
}

const handleDragStart = (e: DragEvent, index: number) => {
  (e.dataTransfer as DataTransfer).setData('text/plain', index.toString())
}

const handleDrop = async (e: DragEvent, targetIndex: number) => {
  const sourceIndex = parseInt((e.dataTransfer as DataTransfer).getData('text/plain'))
  if (sourceIndex === targetIndex) return

  const scenes = [...sceneStore.scenes]
  const [removed] = scenes.splice(sourceIndex, 1)
  scenes.splice(targetIndex, 0, removed)

  // Update order
  const episodeId = episodeStore.episodes[0]?.id
  if (episodeId) {
    await sceneStore.reorderScenes(episodeId, scenes.map(s => s.id))
  }
}

const getStatusType = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'processing': return 'warning'
    case 'failed': return 'error'
    default: return 'default'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return '待生成'
    case 'processing': return '生成中'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    default: return status
  }
}

const modelOptions = [
  { label: 'Wan 2.6 (试错模式 $0.07/秒)', value: 'wan2.6' },
  { label: 'Seedance 2.0 (高光模式 约1元/秒)', value: 'seedance2.0' }
]
</script>

<template>
  <div class="storyboard-container">
    <NCard title="分镜控制台">
      <template #header-extra>
        <NSpace>
          <NSwitch v-model:value="isTrialMode" />
          <span>{{ isTrialMode ? '试错模式' : '高光模式' }}</span>
          <NSelect v-model:value="selectedModel" :options="modelOptions" style="width: 200px" />
          <NButton @click="showCreateModal = true">添加分镜</NButton>
          <NButton
            type="primary"
            :disabled="selectedScenes.size === 0"
            @click="handleBatchGenerate"
          >
            批量生成 ({{ selectedScenes.size }})
          </NButton>
        </NSpace>
      </template>

      <!-- Task Queue Panel -->
      <NAlert v-if="pollingTasks.size > 0" type="info" class="task-alert">
        正在进行 {{ pollingTasks.size }} 个视频生成任务...
      </NAlert>

      <div v-if="sceneStore.scenes.length === 0" class="empty-state">
        <NEmpty description="暂无分镜">
          <template #extra>
            <NButton type="primary" @click="showCreateModal = true">添加第一个分镜</NButton>
          </template>
        </NEmpty>
      </div>

      <div v-else class="scenes-list">
        <div
          v-for="(scene, index) in sceneStore.scenes"
          :key="scene.id"
          class="scene-card"
          draggable="true"
          @dragstart="handleDragStart($event, index)"
          @drop="handleDrop($event, index)"
          @dragover.prevent
        >
          <div class="scene-header" @click="handleEditScene(scene)">
            <div class="scene-info">
              <NTag :type="getStatusType(scene.status)" size="small">
                {{ getStatusLabel(scene.status) }}
              </NTag>
              <span class="scene-num">#{{ scene.sceneNum }}</span>
              <span class="scene-desc">{{ scene.description || '未描述' }}</span>
            </div>
            <div class="scene-select" @click.stop>
              <NCheckbox
                :checked="selectedScenes.has(scene.id)"
                @update:checked="() => toggleSceneSelection(scene.id)"
              />
            </div>
          </div>

          <div class="scene-content">
            <div class="scene-prompt">
              <span class="prompt-label">提示词：</span>
              <span class="prompt-text">{{ scene.prompt || '未填写' }}</span>
            </div>

            <!-- Video Tasks -->
            <div v-if="scene.tasks?.length" class="scene-tasks">
              <div
                v-for="task in scene.tasks"
                :key="task.id"
                :class="['task-item', { selected: task.isSelected, processing: task.status === 'processing' }]"
              >
                <div class="task-info">
                  <NTag size="tiny" :type="task.model === 'wan2.6' ? 'info' : 'warning'">
                    {{ task.model === 'wan2.6' ? 'Wan 2.6' : 'Seedance' }}
                  </NTag>
                  <NTag v-if="task.isSelected" size="tiny" type="success">已选中</NTag>
                  <span v-if="task.status === 'completed'" class="task-cost">${{ task.cost }}</span>
                </div>

                <div v-if="task.status === 'processing'" class="task-progress">
                  <NProgress type="line" :percentage="50" :show-indicator="false" />
                </div>

                <div v-if="task.status === 'completed'" class="task-thumbnail" @click="task.videoUrl && handlePreviewVideo(task.videoUrl, task.thumbnailUrl)">
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

                <div v-if="task.status === 'completed'" class="task-actions">
                  <NButton
                    v-if="!task.isSelected"
                    size="tiny"
                    @click="handleSelectTask(scene.id, task.id)"
                  >
                    选中
                  </NButton>
                </div>
              </div>
            </div>
          </div>

          <div class="scene-footer">
            <NButton
              v-if="scene.status !== 'processing'"
              size="small"
              type="primary"
              @click="handleGenerate(scene.id)"
            >
              生成视频
            </NButton>
            <NButton size="small" @click="handleEditScene(scene)">编辑</NButton>
            <NButton size="small" type="error" @click="handleDeleteScene(scene.id)">删除</NButton>
          </div>
        </div>
      </div>

      <!-- Character Reference -->
      <div v-if="characterStore.characters.length > 0" class="character-refs">
        <div class="refs-title">角色参考图</div>
        <div class="refs-list">
          <div
            v-for="char in characterStore.characters"
            :key="char.id"
            :class="['ref-item', { active: selectedReferenceImage === char.avatarUrl }]"
            @click="selectedReferenceImage = selectedReferenceImage === char.avatarUrl ? undefined : char.avatarUrl"
          >
            <NImage
              v-if="char.avatarUrl"
              :src="char.avatarUrl"
              width="60"
              height="60"
              object-fit="cover"
            />
            <div v-else class="ref-placeholder">{{ char.name }}</div>
            <span class="ref-name">{{ char.name }}</span>
          </div>
        </div>
      </div>
    </NCard>

    <!-- Create Scene Modal -->
    <NModal v-model:show="showCreateModal" preset="card" title="添加分镜" style="width: 500px">
      <NForm :model="newScene">
        <NFormItem label="场景描述" path="description">
          <NInput
            v-model:value="newScene.description"
            type="textarea"
            placeholder="描述这个场景的内容"
            :rows="3"
          />
        </NFormItem>
        <NFormItem label="视频提示词（可选）" path="prompt">
          <NInput
            v-model:value="newScene.prompt"
            type="textarea"
            placeholder="用于生成视频的提示词，不填则使用场景描述"
            :rows="3"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateScene">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Edit Scene Modal -->
    <NModal v-model:show="showEditorModal" preset="card" title="编辑分镜" style="width: 600px">
      <NForm v-if="editingScene" :model="editingScene">
        <NFormItem label="场景编号" path="sceneNum">
          <NInput v-model:value="editingScene.sceneNum" type="number" />
        </NFormItem>
        <NFormItem label="场景描述" path="description">
          <NInput
            v-model:value="editingScene.description"
            type="textarea"
            placeholder="描述这个场景的内容"
            :rows="2"
          />
        </NFormItem>
        <NFormItem label="视频提示词" path="prompt">
          <NInput
            v-model:value="editingScene.prompt"
            type="textarea"
            placeholder="用于生成视频的提示词"
            :rows="4"
          />
        </NFormItem>
        <NFormItem>
          <NButton @click="handleOptimizePrompt" :loading="sceneStore.isGenerating">
            AI优化提示词
          </NButton>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showEditorModal = false">取消</NButton>
          <NButton type="primary" @click="handleSaveScene">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Video Preview -->
    <VideoPlayer
      v-model:show="showVideoPreview"
      :video-url="previewVideoUrl"
      :thumbnail-url="previewThumbnailUrl"
    />
  </div>
</template>

<style scoped>
.storyboard-container {
  height: 100%;
}

.task-alert {
  margin-bottom: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.scenes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.scene-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  cursor: grab;
  transition: all 0.2s;
}

.scene-card:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
}

.scene-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  cursor: pointer;
}

.scene-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scene-num {
  font-weight: 600;
  color: #333;
}

.scene-desc {
  color: #666;
  font-size: 14px;
}

.scene-content {
  margin-bottom: 12px;
}

.scene-prompt {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}

.prompt-label {
  font-weight: 500;
}

.prompt-text {
  color: #333;
}

.scene-tasks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  border: 2px solid transparent;
}

.task-item.selected {
  border-color: #52c41a;
  background: #f6ffed;
}

.task-item.processing {
  background: #fffbe6;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-cost {
  font-size: 12px;
  color: #52c41a;
}

.task-progress {
  width: 60px;
}

.task-thumbnail {
  border-radius: 4px;
  overflow: hidden;
}

.thumbnail-placeholder {
  width: 80px;
  height: 45px;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
}

.task-actions {
  margin-left: auto;
}

.scene-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.character-refs {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e8e8e8;
}

.refs-title {
  font-weight: 500;
  margin-bottom: 12px;
}

.refs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.ref-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.ref-item:hover {
  background: #f5f5f5;
}

.ref-item.active {
  background: #e6f4ff;
  outline: 2px solid #1890ff;
}

.ref-placeholder {
  width: 60px;
  height: 60px;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
  border-radius: 4px;
}

.ref-name {
  font-size: 12px;
  color: #666;
}
</style>
