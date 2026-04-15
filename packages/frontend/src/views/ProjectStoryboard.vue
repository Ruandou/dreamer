<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton, NSpace, NModal, NForm, NFormItem, NInput, NInputNumber,
  NSelect, NImage, NTag, NProgress, NAlert, NSwitch, NCheckbox,
  NScrollbar, useMessage, useDialog, NDropdown
} from 'naive-ui'
import { useSceneStore, type SceneWithTakes } from '@/stores/scene'
import { useEpisodeStore } from '@/stores/episode'
import { useCharacterStore } from '@/stores/character'
import VideoPlayer from '@/components/VideoPlayer.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const sceneStore = useSceneStore()
const episodeStore = useEpisodeStore()
const characterStore = useCharacterStore()

function primaryPrompt(scene: SceneWithTakes): string {
  const shots = scene.shots as { description?: string }[] | undefined
  const first = shots?.[0]?.description?.trim()
  if (first) return first
  return scene.description?.trim() || '使用场景描述'
}

function characterPreviewUrl(char: { images?: { avatarUrl?: string }[] }): string | undefined {
  return char.images?.find((i) => i.avatarUrl)?.avatarUrl
}

const projectId = computed(() => route.params.id as string)

/** 当前分集（与 URL ?episodeId= 同步，避免多集项目始终误绑第一集） */
const currentEpisodeId = ref<string | null>(null)

const showCreateModal = ref(false)
const showEditorModal = ref(false)
type SceneEditor = SceneWithTakes & { editPrompt: string }
const editingScene = ref<SceneEditor | null>(null)
const newScene = ref({ description: '', prompt: '' })
const selectedModel = ref<'wan2.6' | 'seedance2.0'>('wan2.6')
const selectedReferenceImage = ref<string | undefined>()
const isTrialMode = ref(true)
const selectedScenes = ref<Set<string>>(new Set())

// Video preview
const showVideoPreview = ref(false)
const previewVideoUrl = ref<string | undefined>()
const previewThumbnailUrl = ref<string | undefined>()

// Polling state
const pollingTasks = ref<Map<string, number>>(new Map())

const episodeSelectOptions = computed(() =>
  episodeStore.episodes.map((e) => ({
    label: `第 ${e.episodeNum} 集${e.title ? ` · ${e.title}` : ''}`,
    value: e.id
  }))
)

async function loadScenesForEpisode(episodeId: string) {
  await sceneStore.fetchEpisodeScenesDetail(episodeId)
}

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
  if (!episodeStore.episodes.length) {
    currentEpisodeId.value = null
    await characterStore.fetchCharacters(projectId.value)
    return
  }
  const fromQuery = route.query.episodeId as string | undefined
  const valid = fromQuery && episodeStore.episodes.some((e) => e.id === fromQuery)
  const id = valid ? fromQuery! : episodeStore.episodes[0].id
  currentEpisodeId.value = id
  if (!valid) {
    await router.replace({ query: { ...route.query, episodeId: id } })
  }
  pollingTasks.value.clear()
  await loadScenesForEpisode(id)
  await characterStore.fetchCharacters(projectId.value)
})

watch(
  () => route.query.episodeId,
  async (q) => {
    const qid = typeof q === 'string' ? q : undefined
    if (!qid || !episodeStore.episodes.some((e) => e.id === qid)) return
    if (qid === currentEpisodeId.value) return
    currentEpisodeId.value = qid
    pollingTasks.value.clear()
    selectedScenes.value.clear()
    selectedScenes.value = new Set()
    await loadScenesForEpisode(qid)
  }
)

function onEpisodeSelect(episodeId: string) {
  router.push({ query: { ...route.query, episodeId } })
}

watch(() => sceneStore.scenes, (scenes) => {
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
  if (!currentEpisodeId.value) return
  await sceneStore.createScene({
    episodeId: currentEpisodeId.value,
    sceneNum: sceneStore.scenes.length + 1,
    description: newScene.value.description,
    prompt: newScene.value.prompt || newScene.value.description
  })
  showCreateModal.value = false
  newScene.value = { description: '', prompt: '' }
  message.success('分镜创建成功')
}

const handleEditScene = (scene: SceneWithTakes) => {
  const base = primaryPrompt(scene)
  editingScene.value = {
    ...scene,
    editPrompt: base === '使用场景描述' ? '' : base
  }
  showEditorModal.value = true
}

const handleSaveScene = async () => {
  if (!editingScene.value) return
  await sceneStore.updateScene(editingScene.value.id, {
    description: editingScene.value.description,
    sceneNum: editingScene.value.sceneNum,
    prompt: editingScene.value.editPrompt
  })
  showEditorModal.value = false
  message.success('保存成功')
}

const handleOptimizePrompt = async () => {
  if (!editingScene.value) return
  const optimized = await sceneStore.optimizePrompt(editingScene.value.id, editingScene.value.editPrompt)
  editingScene.value.editPrompt = optimized
  message.success('提示词优化完成')
}

const handleGenerate = async (sceneId: string) => {
  await sceneStore.generateVideo(sceneId, selectedModel.value, {
    referenceImage: selectedReferenceImage.value
  })
  message.info('视频生成任务已提交')
  startPolling(sceneId)
}

const handleBatchGenerate = async () => {
  if (selectedScenes.value.size === 0) return
  await sceneStore.batchGenerate(
    Array.from(selectedScenes.value),
    selectedModel.value,
    {
      referenceImage: selectedReferenceImage.value
    }
  )
  message.info(`已提交 ${selectedScenes.value.size} 个生成任务`)
  Array.from(selectedScenes.value).forEach(id => startPolling(id))
}

const handleSelectTask = async (sceneId: string, taskId: string) => {
  await sceneStore.selectTask(sceneId, taskId)
  message.success('已选中该版本')
}

const handlePreviewVideo = (videoUrl: string, thumbnailUrl?: string) => {
  previewVideoUrl.value = videoUrl
  previewThumbnailUrl.value = thumbnailUrl
  showVideoPreview.value = true
}

const handleDeleteScene = (id: string) => {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这个分镜吗？此操作不可撤销。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await sceneStore.deleteScene(id)
      message.success('分镜已删除')
    }
  })
}

const toggleSceneSelection = (sceneId: string) => {
  if (selectedScenes.value.has(sceneId)) {
    selectedScenes.value.delete(sceneId)
  } else {
    selectedScenes.value.add(sceneId)
  }
  selectedScenes.value = new Set(selectedScenes.value)
}

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedScenes.value = new Set(sceneStore.scenes.map(s => s.id))
  } else {
    selectedScenes.value.clear()
    selectedScenes.value = new Set(selectedScenes.value)
  }
}

const batchOptions = [
  { label: '批量生成', key: 'generate' },
  { label: '批量删除', key: 'delete' }
]

const handleBatchAction = (key: string) => {
  if (key === 'generate') {
    handleBatchGenerate()
  } else if (key === 'delete') {
    handleBatchDelete()
  }
}

const handleBatchDelete = () => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除选中的 ${selectedScenes.value.size} 个分镜吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      for (const sceneId of selectedScenes.value) {
        await sceneStore.deleteScene(sceneId)
      }
      selectedScenes.value.clear()
      selectedScenes.value = new Set(selectedScenes.value)
      message.success('批量删除完成')
    }
  })
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

  const episodeId = currentEpisodeId.value
  if (episodeId) {
    await sceneStore.reorderScenes(episodeId, scenes.map(s => s.id))
    message.success('分镜顺序已更新')
  }
}

const modelOptions = [
  { label: 'Wan 2.6 试错模式', value: 'wan2.6' },
  { label: 'Seedance 2.0 高光模式', value: 'seedance2.0' }
]

const getSceneTakes = (scene: SceneWithTakes) => scene.takes ?? []
</script>

<template>
  <div class="storyboard-page">
    <!-- Header -->
    <header class="storyboard-header">
      <div class="storyboard-header__left">
        <NButton quaternary size="small" class="storyboard-back" @click="router.push(`/project/${projectId}/episodes`)">
          ← 返回分集管理
        </NButton>
        <h2 class="storyboard-header__title">分镜控制台</h2>
        <NSelect
          v-if="episodeSelectOptions.length"
          :value="currentEpisodeId ?? undefined"
          :options="episodeSelectOptions"
          placeholder="选择分集"
          filterable
          style="min-width: 200px; max-width: 280px"
          @update:value="(v: string) => onEpisodeSelect(v)"
        />
        <div class="mode-toggle">
          <NSwitch v-model:value="isTrialMode" size="small" />
          <span class="mode-label">{{ isTrialMode ? '试错模式' : '高光模式' }}</span>
        </div>
      </div>
      <div class="storyboard-header__right">
        <NCheckbox
          v-if="sceneStore.scenes.length > 0"
          :checked="selectedScenes.size === sceneStore.scenes.length && sceneStore.scenes.length > 0"
          :indeterminate="selectedScenes.size > 0 && selectedScenes.size < sceneStore.scenes.length"
          @update:checked="toggleSelectAll"
        >
          {{ selectedScenes.size > 0 ? `已选 ${selectedScenes.size}/${sceneStore.scenes.length}` : '全选' }}
        </NCheckbox>

        <NSelect
          v-model:value="selectedModel"
          :options="modelOptions"
          style="width: 180px"
        />
        <NButton @click="showCreateModal = true">
          <template #icon>+</template>
          添加分镜
        </NButton>
        <NDropdown
          v-if="selectedScenes.size > 0"
          trigger="click"
          :options="batchOptions"
          @select="handleBatchAction"
        >
          <NButton type="primary">
            批量操作 ({{ selectedScenes.size }})
          </NButton>
        </NDropdown>
        <NButton
          v-else
          type="primary"
          :disabled="selectedScenes.size === 0"
          @click="handleBatchGenerate"
        >
          批量生成
        </NButton>
      </div>
    </header>

    <!-- Task Alert -->
    <NAlert
      v-if="pollingTasks.size > 0"
      type="info"
      class="task-alert"
    >
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
          <NButton type="primary" @click="showCreateModal = true">
            添加第一个分镜
          </NButton>
        </template>
      </EmptyState>

      <!-- Scenes List -->
      <div v-else class="scenes-list">
        <NScrollbar>
          <div
            v-for="(scene, index) in sceneStore.scenes"
            :key="scene.id"
            class="scene-card"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @drop="handleDrop($event, index)"
            @dragover.prevent
          >
            <!-- Scene Header -->
            <div class="scene-card__header" @click="handleEditScene(scene as SceneWithTakes)">
              <div class="scene-card__info">
                <StatusBadge :status="scene.status" />
                <span class="scene-card__num">#{{ scene.sceneNum }}</span>
                <span class="scene-card__desc">{{ scene.description || '未描述' }}</span>
              </div>
              <div class="scene-card__select" @click.stop>
                <NCheckbox
                  :checked="selectedScenes.has(scene.id)"
                  @update:checked="() => toggleSceneSelection(scene.id)"
                >
                  选中
                </NCheckbox>
              </div>
            </div>

            <!-- Scene Content -->
            <div class="scene-card__content">
              <!-- Prompt -->
              <div class="scene-card__prompt">
                <span class="prompt-label">提示词</span>
                <span class="prompt-text">{{ primaryPrompt(scene) }}</span>
              </div>

              <!-- Tasks -->
              <div v-if="getSceneTakes(scene).length" class="scene-card__tasks">
                <div
                  v-for="task in getSceneTakes(scene)"
                  :key="task.id"
                  :class="['task-item', { selected: task.isSelected, processing: task.status === 'processing' }]"
                >
                  <div class="task-item__info">
                    <NTag
                      :type="task.model === 'wan2.6' ? 'info' : 'warning'"
                      size="small"
                    >
                      {{ task.model === 'wan2.6' ? 'Wan 2.6' : 'Seedance' }}
                    </NTag>
                    <NTag v-if="task.isSelected" size="small" type="success">已选中</NTag>
                    <span v-if="task.status === 'completed'" class="task-cost">
                      ${{ task.cost?.toFixed(2) }}
                    </span>
                  </div>

                  <!-- Processing Progress -->
                  <div v-if="task.status === 'processing'" class="task-item__progress">
                    <NProgress type="line" :percentage="50" :show-indicator="false" />
                  </div>

                  <!-- Thumbnail -->
                  <div
                    v-if="task.status === 'completed'"
                    class="task-item__thumbnail"
                    @click="task.videoUrl && handlePreviewVideo(task.videoUrl, task.thumbnailUrl)"
                  >
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

                  <!-- Select Button -->
                  <div v-if="task.status === 'completed'" class="task-item__action">
                    <NButton
                      v-if="!task.isSelected"
                      size="small"
                      @click="handleSelectTask(scene.id, task.id)"
                    >
                      选中
                    </NButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scene Footer -->
            <div class="scene-card__footer">
              <NSpace>
                <NButton
                  v-if="scene.status !== 'processing'"
                  size="small"
                  type="primary"
                  @click="handleGenerate(scene.id)"
                >
                  生成视频
                </NButton>
                <NButton size="small" @click="handleEditScene(scene as SceneWithTakes)">
                  编辑
                </NButton>
                <NButton size="small" type="error" text @click="handleDeleteScene(scene.id)">
                  删除
                </NButton>
              </NSpace>
            </div>
          </div>
        </NScrollbar>
      </div>

      <!-- Character Reference -->
      <div v-if="characterStore.characters.length > 0" class="character-refs">
        <h4 class="character-refs__title">角色参考图</h4>
        <NScrollbar x-scrollable>
          <div class="character-refs__list">
            <div
              v-for="char in characterStore.characters"
              :key="char.id"
              :class="['ref-item', { active: selectedReferenceImage === characterPreviewUrl(char) }]"
              @click="selectedReferenceImage = selectedReferenceImage === characterPreviewUrl(char) ? undefined : characterPreviewUrl(char)"
            >
              <NImage
                v-if="characterPreviewUrl(char)"
                :src="characterPreviewUrl(char)"
                width="60"
                height="60"
                object-fit="cover"
              />
              <div v-else class="ref-placeholder">{{ char.name.charAt(0) }}</div>
              <span class="ref-name">{{ char.name }}</span>
            </div>
          </div>
        </NScrollbar>
      </div>
    </div>

    <!-- Create Scene Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="添加分镜"
      style="width: 500px"
    >
      <NForm :model="newScene" label-placement="top">
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
    <NModal
      v-model:show="showEditorModal"
      preset="card"
      title="编辑分镜"
      style="width: 600px"
    >
      <NForm v-if="editingScene" :model="editingScene" label-placement="top">
        <NFormItem label="场景编号" path="sceneNum">
          <NInputNumber
            v-model:value="editingScene.sceneNum"
            :min="1"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="场景描述" path="description">
          <NInput
            v-model:value="editingScene.description"
            type="textarea"
            placeholder="描述这个场景的内容"
            :rows="2"
          />
        </NFormItem>
        <NFormItem label="视频提示词" path="editPrompt">
          <NInput
            v-model:value="editingScene.editPrompt"
            type="textarea"
            placeholder="用于生成视频的提示词"
            :rows="4"
          />
        </NFormItem>
        <NFormItem>
          <NButton
            :loading="sceneStore.isGenerating"
            @click="handleOptimizePrompt"
          >
            ✨ AI 优化提示词
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
.storyboard-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.storyboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.storyboard-header__left .storyboard-back {
  margin-right: 8px;
  flex-shrink: 0;
}
.storyboard-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.storyboard-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.mode-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.mode-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.storyboard-header__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.scene-card {
  background: var(--color-bg-gray);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  cursor: grab;
  transition: all var(--transition-fast);
}

.scene-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.scene-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  cursor: pointer;
}

.scene-card__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.scene-card__num {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.scene-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scene-card__select {
  flex-shrink: 0;
}

.scene-card__content {
  margin-bottom: var(--spacing-md);
}

.scene-card__prompt {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-sm);
}

.prompt-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.prompt-text {
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
}

.scene-card__tasks {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.task-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  transition: all var(--transition-fast);
}

.task-item.selected {
  border-color: var(--color-success);
  background: var(--color-success-light);
}

.task-item.processing {
  background: var(--color-warning-light);
}

.task-item__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.task-cost {
  font-size: var(--font-size-xs);
  color: var(--color-success);
  font-weight: var(--font-weight-medium);
}

.task-item__progress {
  width: 60px;
}

.task-item__thumbnail {
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
}

.thumbnail-placeholder {
  width: 80px;
  height: 45px;
  background: var(--color-bg-gray);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.task-item__action {
  margin-left: auto;
}

.scene-card__footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

/* Character References */
.character-refs {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.character-refs__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
}

.character-refs__list {
  display: flex;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
}

.ref-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.ref-item:hover {
  background: var(--color-bg-gray);
}

.ref-item.active {
  background: var(--color-primary-light);
}

.ref-item.active .ref-name {
  color: var(--color-primary);
}

.ref-placeholder {
  width: 60px;
  height: 60px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: var(--font-weight-bold);
}

.ref-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
