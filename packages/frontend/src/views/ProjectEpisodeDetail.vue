<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  useMessage,
  useDialog,
  NSpin,
  NEmpty,
  NTooltip,
  NSelect,
  NDropdown
} from 'naive-ui'
import type { DropdownOption } from 'naive-ui'
import { CaretForwardOutline, ChevronDownOutline, HelpCircleOutline } from '@vicons/ionicons5'
import { useEpisodeStore, type EpisodeDetailPayload } from '@/stores/episode'
import { useEpisodeStoryboardPipelineJob } from '@/composables/useEpisodeStoryboardPipelineJob'
import { useEpisodeScriptEditing } from '@/composables/useEpisodeScriptEditing'
import { api } from '@/api'
import type { ScriptContent, VideoModel } from '@dreamer/shared/types'
import { useSceneStore } from '@/stores/scene'
import StoryboardScriptEditor from '@/components/storyboard/StoryboardScriptEditor.vue'
import EpisodeVideoPreview from '@/components/episode/EpisodeVideoPreview.vue'
import EpisodeAssetLibrary from '@/components/episode/EpisodeAssetLibrary.vue'
import EpisodeSceneTimeline from '@/components/episode/EpisodeSceneTimeline.vue'
import { useEpisodeVideoGeneration } from '@/composables/useEpisodeVideoGeneration'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const episodeStore = useEpisodeStore()
const sceneStore = useSceneStore()

const projectId = computed(() => route.params.id as string)
const episodeId = computed(() => route.params.episodeId as string)

const notFound = ref(false)
const composingId = ref(false)
const detail = ref<EpisodeDetailPayload | null>(null)
const selectedSceneId = ref<string | null>(null)
const selectedShotId = ref<string | null>(null)

const episode = computed(() => detail.value?.episode ?? null)
const scenes = computed(() => (detail.value?.scenes as EpisodeDetailScene[]) ?? [])

const {
  runningByEpisodeId: storyboardJobRunningByEpisode,
  refresh: refreshStoryboardPipelineJobs
} = useEpisodeStoryboardPipelineJob(projectId)

const storyboardJobRunning = computed(
  () => storyboardJobRunningByEpisode.value[episodeId.value] === true
)

interface EpisodeDetailScene {
  id: string
  sceneNum: number
  name?: string
  description?: string
  duration?: number
  status?: string
  location?: { id: string; name: string; imageUrl?: string | null } | null
  shots?: Array<{
    id: string
    shotNum: number
    order: number
    description: string
    duration?: number
    cameraAngle?: string | null
    cameraMovement?: string | null
    characterShots?: Array<{
      id: string
      action?: string | null
      characterImage?: {
        id: string
        name: string
        avatarUrl?: string | null
        character?: { id: string; name: string }
      }
    }>
  }>
  dialogues?: Array<{
    id: string
    text: string
    startTimeMs: number
    character?: { id: string; name: string }
  }>
  takes?: Array<{
    id: string
    status: string
    videoUrl?: string | null
    thumbnailUrl?: string | null
    isSelected?: boolean
    duration?: number | null
  }>
}

const selectedScene = computed(() => {
  const id = selectedSceneId.value
  if (!id) return null
  return scenes.value.find((s) => s.id === id) ?? null
})

// Script editing composable
const { scriptEditing, scriptSaving, onSaveScript, onCancelScriptEdit, onStartEdit } =
  useEpisodeScriptEditing({
    episodeScript: computed(() => episode.value?.script),
    selectedSceneNum: computed(() => selectedScene.value?.sceneNum),
    updateEpisode: (id, data) => episodeStore.updateEpisode(id, data),
    reload: load,
    episodeId
  })

// Video generation composable (must be after selectedScene)
async function doGenerateVideo(sceneId: string, model: VideoModel) {
  await sceneStore.generateVideo(sceneId, model, {})
}

const { videoModel, videoModelOptions, canGenerateSceneVideo, generateSceneVideo } =
  useEpisodeVideoGeneration({
    canGenerate: computed(() => {
      const sc = selectedScene.value
      if (!sc) return false
      if (sc.status === 'processing') return false
      return true
    }),
    storyboardJobRunning: storyboardJobRunning.value,
    selectedScene: computed(() => {
      const sc = selectedScene.value
      if (!sc) return null
      return { id: sc.id, name: sc.name, status: sc.status }
    }),
    generateVideo: doGenerateVideo,
    reload: load
  })

const sceneDurationLabel = computed(() => {
  const ms = selectedScene.value?.duration ?? 0
  if (ms <= 0) return '00:00'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function exportEpisodeScript() {
  const raw = episode.value?.script
  const blob = new Blob([JSON.stringify(raw ?? {}, null, 2)], {
    type: 'application/json;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `episode-${episodeId.value}-script.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('已导出本集剧本 JSON（含 editorDoc）')
}

async function load() {
  notFound.value = false
  detail.value = null
  selectedSceneId.value = null
  selectedShotId.value = null
  try {
    const data = await episodeStore.fetchEpisodeDetail(episodeId.value)
    if (data.episode.projectId !== projectId.value) {
      notFound.value = true
      return
    }
    detail.value = data
    const list = data.scenes as EpisodeDetailScene[]
    if (list.length) {
      selectedSceneId.value = list[0].id
      syncDefaultShot(list[0])
    }
  } catch {
    notFound.value = true
  }
}

function syncDefaultShot(sc: EpisodeDetailScene) {
  const shots = sc.shots
  if (shots?.length) selectedShotId.value = shots[0].id
  else selectedShotId.value = null
}

watch(selectedScene, (sc) => {
  if (sc) syncDefaultShot(sc)
})

onMounted(() => {
  void load()
})

watch(
  () => [projectId.value, episodeId.value] as const,
  () => {
    scriptEditing.value = false
    void load()
  }
)

watch(storyboardJobRunning, (on, was) => {
  if (was === true && on === false) void load()
})

function goBack() {
  router.push(`/project/${projectId.value}/episodes`)
}

function openStoryboard() {
  router.push({
    path: `/project/${projectId.value}/storyboard`,
    query: { episodeId: episodeId.value }
  })
}

function openGenerateStoryboardDialog() {
  if (episode.value?.listStats?.storyboardScriptJobCompleted) {
    message.warning('本集已使用 AI 生成分镜脚本，仅支持操作一次')
    return
  }
  if (storyboardJobRunning.value) {
    message.warning('分镜剧本任务已在运行中')
    return
  }
  dialog.warning({
    title: 'AI 生成分镜脚本',
    content:
      '将使用本集梗概与（若存在）已有剧本中的场次/梗概；生成后会替换当前集场次，并写入多镜 Shot、CharacterShot 与台词（若模型输出包含 shots）。',
    positiveText: '开始生成',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const data = await episodeStore.generateStoryboardScript(episodeId.value)
        message.success(
          data.message ||
            `任务已提交（${data.jobId}），请稍后在任务中心查看进度，完成后刷新本页或分镜控制台`
        )
        await refreshStoryboardPipelineJobs()
        await load()
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string; message?: string } } }
        const d = err?.response?.data
        message.error(d?.error || d?.message || '生成失败')
        throw e
      }
    }
  })
}

async function composeEpisode() {
  composingId.value = true
  try {
    const res = await api.post<{ outputUrl?: string; compositionId?: string }>(
      `/episodes/${episodeId.value}/compose`,
      {}
    )
    message.success(res.data.outputUrl ? '本集成片已导出' : '合成完成')
    if (res.data.outputUrl) {
      window.open(res.data.outputUrl, '_blank', 'noopener')
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string; details?: string[] } } }
    const d = err?.response?.data
    message.error(d?.error || d?.details?.join?.('; ') || '合成失败')
  } finally {
    composingId.value = false
  }
}

const titleLine = computed(() => {
  const ep = episode.value
  if (!ep) return ''
  return ep.title?.trim() || `第 ${ep.episodeNum} 集`
})

const storyboardScriptLocked = computed(
  () => episode.value?.listStats?.storyboardScriptJobCompleted === true
)

const storyboardAiDisabled = computed(
  () => storyboardScriptLocked.value || storyboardJobRunning.value
)

const moreMenuOptions = computed<DropdownOption[]>(() => [
  { label: '分镜控制台', key: 'storyboard' },
  {
    label: 'AI 生成分镜',
    key: 'ai',
    disabled: storyboardAiDisabled.value
  },
  { type: 'divider', key: 'd-tools' },
  { label: '导出剧本 JSON', key: 'export' }
])

function onMoreSelect(key: string | number) {
  if (key === 'storyboard') openStoryboard()
  if (key === 'ai') openGenerateStoryboardDialog()
  if (key === 'export') exportEpisodeScript()
}

const editorScript = computed<ScriptContent | null>(() => {
  const script = episode.value?.script
  if (!script || typeof script !== 'object') return null
  const o = script as Record<string, unknown>

  // 只显示当前选中场次
  const sceneList = Array.isArray(o.scenes) ? o.scenes : []
  const currentSceneNum = selectedScene.value?.sceneNum
  const filteredScenes = currentSceneNum
    ? sceneList.filter((s: any) => s.sceneNum === currentSceneNum)
    : sceneList

  return {
    title: typeof o.title === 'string' ? o.title : '',
    summary: typeof o.summary === 'string' ? o.summary : '',
    scenes: filteredScenes as any[],
    editorDoc: o.editorDoc as Record<string, unknown> | null
  }
})
</script>

<template>
  <div class="episode-detail">
    <NSpin
      :show="episodeStore.isLoading && !detail && !notFound"
      description="加载中…"
      class="episode-detail-root-spin"
    >
      <div class="episode-detail__mount">
        <NEmpty v-if="notFound" description="分集不存在或无权访问">
          <template #extra>
            <NButton @click="goBack">返回分集列表</NButton>
          </template>
        </NEmpty>

        <template v-else-if="detail && episode">
          <NSpin
            :show="storyboardJobRunning"
            size="small"
            description="分镜剧本生成中…"
            class="episode-detail-card-spin"
          >
            <div class="episode-detail__shell">
              <header class="episode-detail__topbar">
                <div class="episode-detail__topbar-left">
                  <NButton quaternary size="small" @click="goBack">返回</NButton>
                  <div class="episode-detail__topbar-titles">
                    <span class="episode-detail__topbar-title">{{ titleLine }}</span>
                    <span v-if="episode.synopsis?.trim()" class="episode-detail__topbar-sub">{{
                      episode.synopsis
                    }}</span>
                  </div>
                </div>
                <div class="episode-detail__topbar-right">
                  <NSelect
                    v-model:value="videoModel"
                    :options="videoModelOptions"
                    size="small"
                    placeholder="生成模型"
                    class="episode-detail__model-select"
                  />
                  <NButton
                    size="small"
                    type="primary"
                    :loading="composingId"
                    :disabled="storyboardJobRunning"
                    @click="composeEpisode"
                  >
                    合成全集
                  </NButton>
                  <NTooltip placement="bottom">
                    <template #trigger>
                      <NButton
                        size="small"
                        quaternary
                        circle
                        class="episode-detail__toolbar-icon"
                        aria-label="积分说明"
                      >
                        <template #icon>
                          <HelpCircleOutline />
                        </template>
                      </NButton>
                    </template>
                    积分与账单以方舟控制台为准，本页不展示实时余额
                  </NTooltip>
                  <NDropdown trigger="click" :options="moreMenuOptions" @select="onMoreSelect">
                    <NButton size="small" quaternary class="episode-detail__menu-trigger">
                      更多
                      <ChevronDownOutline class="episode-detail__menu-trigger-chev" />
                    </NButton>
                  </NDropdown>
                </div>
              </header>

              <div class="episode-detail__body">
                <aside class="episode-detail__assets">
                  <EpisodeAssetLibrary :scenes="scenes" />
                </aside>

                <div class="episode-detail__work">
                  <div class="episode-detail__work-top">
                    <main class="episode-detail__main-col">
                      <div class="episode-detail__editor-wrap">
                        <StoryboardScriptEditor
                          :key="episodeId"
                          :project-id="projectId"
                          :script="editorScript"
                          :editing="scriptEditing"
                          :saving="scriptSaving"
                          :fragment-title="
                            selectedScene ? `片段 ${selectedScene.sceneNum}` : '片段'
                          "
                          @start-edit="onStartEdit"
                          @cancel="onCancelScriptEdit"
                          @save="onSaveScript"
                        >
                          <template #fab-extra />
                          <template #below-editor>
                            <NTooltip :disabled="canGenerateSceneVideo" placement="top">
                              <template #trigger>
                                <span class="episode-detail__fab-gen-wrap">
                                  <NButton
                                    size="tiny"
                                    type="primary"
                                    :loading="sceneStore.isGenerating"
                                    :disabled="!canGenerateSceneVideo"
                                    @click="generateSceneVideo"
                                  >
                                    生成视频
                                  </NButton>
                                </span>
                              </template>
                              <span v-if="!selectedScene"
                                >需有已入库场次（可通过分镜控制台或 AI 分镜剧本生成）</span
                              >
                              <span v-else-if="storyboardJobRunning">分镜剧本任务运行中</span>
                              <span v-else-if="selectedScene?.status === 'processing'"
                                >当前场次视频生成中</span
                              >
                            </NTooltip>
                          </template>
                        </StoryboardScriptEditor>
                      </div>
                    </main>

                    <aside class="episode-detail__preview-col">
                      <EpisodeVideoPreview :scene="selectedScene" />
                    </aside>
                  </div>

                  <div v-if="scenes.length" class="episode-detail__work-bottom">
                    <div class="episode-detail__transport">
                      <NButton size="small" quaternary circle disabled aria-label="播放（占位）">
                        <template #icon>
                          <CaretForwardOutline />
                        </template>
                      </NButton>
                      <span class="episode-detail__transport-time">
                        00:00 / {{ sceneDurationLabel }}
                      </span>
                      <span class="episode-detail__transport-hint">时间轴占位，成片以导出为准</span>
                    </div>

                    <EpisodeSceneTimeline
                      :scenes="scenes"
                      :selected-scene-id="selectedSceneId"
                      @select="selectedSceneId = $event"
                    />
                  </div>
                </div>
              </div>
            </div>
          </NSpin>
        </template>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.episode-detail {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
/* 与 ProjectDetail.project-content 的 flex 列配合；有 default 时根节点为 n-spin-container */
.episode-detail-root-spin {
  flex: 1;
  min-height: 0;
  display: flex !important;
  flex-direction: column;
}
.episode-detail-root-spin :deep(.n-spin-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.episode-detail__mount {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.episode-detail__shell {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  flex: 1;
  min-height: 0;
  height: 100%;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
  overflow: hidden;
}
.episode-detail__topbar-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.episode-detail__topbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}
.episode-detail__model-select {
  width: 156px;
  max-width: min(200px, 36vw);
}
.episode-detail__menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.episode-detail__menu-trigger-chev {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.75;
}
.episode-detail__toolbar-icon {
  flex-shrink: 0;
}
.episode-detail__divider {
  margin: 4px 0 12px;
}
.episode-detail-card-spin {
  flex: 1;
  min-height: 0;
  display: flex !important;
  flex-direction: column;
}
.episode-detail-card-spin :deep(.n-spin-content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.episode-detail__topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}
.episode-detail__topbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.episode-detail__topbar-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.episode-detail__topbar-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 左：资产栏纵向拉满；右：上为编辑+预览对齐，下为时间轴+镜头条（仅右区，与编辑区左缘对齐） */
.episode-detail__body {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: var(--spacing-md);
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.episode-detail__work {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.episode-detail__work-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: var(--spacing-md);
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.episode-detail__work-bottom {
  flex-shrink: 0;
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
}
.episode-detail__work-bottom .episode-detail__transport {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}
@media (max-width: 1100px) {
  .episode-detail__body {
    grid-template-columns: 1fr;
    height: auto;
    max-height: none;
  }
  .episode-detail__assets {
    max-height: min(40vh, 360px);
  }
  .episode-detail__work-top {
    grid-template-columns: 1fr;
  }
  .episode-detail__editor-wrap {
    max-height: min(480px, 58vh);
  }
}
.episode-detail__assets {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 12px;
  background: var(--color-bg-gray);
  min-height: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.episode-detail__assets-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  margin-right: -12px;
  padding-right: 12px;
}
.episode-detail__assets-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.episode-detail__assets-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  margin-bottom: 2px;
  flex-shrink: 0;
}
.episode-detail__asset-block {
  margin-bottom: 14px;
}
.episode-detail__asset-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-xs);
}
.episode-detail__asset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.episode-detail__asset-grid--loc {
  grid-template-columns: repeat(2, 1fr);
}
.episode-detail__asset-tile {
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: transform var(--transition-fast);
}
.episode-detail__asset-tile:hover {
  transform: translateY(-2px);
}
.episode-detail__asset-thumb-wrap {
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 3/4;
  background: #e2e8f0;
  margin-bottom: 4px;
}
.episode-detail__asset-thumb-wrap--loc {
  aspect-ratio: 16/10;
}
.episode-detail__asset-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.episode-detail__asset-placeholder {
  width: 100%;
  height: 100%;
  min-height: 64px;
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
}
.episode-detail__asset-name {
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.episode-detail__asset-empty {
  grid-column: 1 / -1;
  margin: 0;
}
.episode-detail__editor-wrap {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.episode-detail__main-col {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 12px;
  background: var(--color-bg-gray);
  position: relative;
  height: 100%;
}
/* 编辑框下方按钮区域 */
.episode-detail__main-col :deep(.storyboard-script-editor__fab-bar) {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
}
/* 三个区域统一滚动条样式 */
.episode-detail__assets-content,
.episode-detail__main-col,
.episode-detail__preview-col {
  overflow-y: auto;
  overflow-x: hidden;
}
.episode-detail__assets-content::-webkit-scrollbar,
.episode-detail__main-col::-webkit-scrollbar,
.episode-detail__preview-col::-webkit-scrollbar {
  width: 6px;
}
.episode-detail__assets-content::-webkit-scrollbar-track,
.episode-detail__main-col::-webkit-scrollbar-track,
.episode-detail__preview-col::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}
.episode-detail__assets-content::-webkit-scrollbar-thumb,
.episode-detail__main-col::-webkit-scrollbar-thumb,
.episode-detail__preview-col::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
.episode-detail__assets-content::-webkit-scrollbar-thumb:hover,
.episode-detail__main-col::-webkit-scrollbar-thumb:hover,
.episode-detail__preview-col::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}
.episode-detail__editor-wrap :deep(.storyboard-script-editor) {
  height: 100%;
}
/* 统一编辑器标题样式 */
.episode-detail__editor-wrap :deep(.storyboard-script-editor__title) {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.episode-detail__preview-col {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 12px;
  background: var(--color-bg-gray);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.episode-detail__preview-label {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  margin-bottom: 2px;
  color: var(--color-text-primary);
  flex-shrink: 0;
}
.episode-detail__fab-gen-wrap {
  display: inline-flex;
  vertical-align: middle;
}
/* 竖屏 9:16：在列内垂直居中，宽不超过列宽、高不超过剩余空间 */
.episode-detail__preview-frame {
  flex: 1;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.episode-detail__preview-box {
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 9 / 16;
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg-dark);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}
.episode-detail__preview-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}
.episode-detail__preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}
.episode-detail__preview-poster {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.episode-detail__preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.episode-detail__preview-empty-icon {
  font-size: 32px;
  opacity: 0.5;
}
.episode-detail__transport {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  padding: var(--spacing-sm) 0 var(--spacing-xs);
  margin-top: var(--spacing-xs);
  border-top: 1px dashed var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.episode-detail__transport-time {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}
.episode-detail__transport-hint {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.85;
}
.episode-detail__muted {
  color: var(--color-text-tertiary);
  font-size: 12px;
}
</style>
