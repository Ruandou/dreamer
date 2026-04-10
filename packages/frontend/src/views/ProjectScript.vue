<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput,
  NSpin, NAlert, NCollapse, NCollapseItem, NTag, NUpload, useMessage,
  NTooltip, NScrollbar
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { useEpisodeStore } from '@/stores/episode'
import { importScript } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const route = useRoute()
const message = useMessage()
const episodeStore = useEpisodeStore()

const projectId = computed(() => route.params.id as string)
const showCreateModal = ref(false)
const showExpandModal = ref(false)
const showImportModal = ref(false)
const newEpisode = ref({ episodeNum: 1, title: '' })
const summary = ref('')
const importContent = ref('')
const isImporting = ref(false)

const selectedEpisodeId = ref<string | null>(null)

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
  if (episodeStore.episodes.length > 0) {
    await episodeStore.getEpisode(episodeStore.episodes[0].id)
    selectedEpisodeId.value = episodeStore.episodes[0].id
  }
})

const handleCreateEpisode = async () => {
  const episode = await episodeStore.createEpisode({
    projectId: projectId.value,
    episodeNum: newEpisode.value.episodeNum,
    title: newEpisode.value.title || `第${newEpisode.value.episodeNum}集`
  })
  showCreateModal.value = false
  newEpisode.value = { episodeNum: episodeStore.episodes.length + 1, title: '' }
  selectedEpisodeId.value = episode.id
  await episodeStore.getEpisode(episode.id)
}

const handleSelectEpisode = async (episodeId: string) => {
  selectedEpisodeId.value = episodeId
  await episodeStore.getEpisode(episodeId)
}

const handleExpandScript = async () => {
  if (!selectedEpisodeId.value || !summary.value.trim()) return

  const result = await episodeStore.expandScript(selectedEpisodeId.value, summary.value)
  showExpandModal.value = false
  summary.value = ''

  if (result) {
    await episodeStore.getEpisode(selectedEpisodeId.value)
    message.success('剧本生成成功')
  }
}

const handleSaveScript = async () => {
  if (!selectedEpisodeId.value || !episodeStore.currentEpisode) return
  await episodeStore.updateEpisode(selectedEpisodeId.value, {
    title: episodeStore.currentEpisode.title || undefined,
    script: episodeStore.currentEpisode.script as any
  })
  message.success('保存成功')
}

const handleImportScript = async () => {
  if (!importContent.value.trim()) {
    message.warning('请输入或粘贴剧本内容')
    return
  }

  isImporting.value = true
  try {
    const result = await importScript(projectId.value, importContent.value, 'markdown')
    message.success(`导入成功！创建了 ${result.episodesCreated} 集，更新了 ${result.episodesUpdated} 集`)
    showImportModal.value = false
    importContent.value = ''
    await episodeStore.fetchEpisodes(projectId.value)
  } catch (error: any) {
    message.error(error.response?.data?.error || '导入失败')
  } finally {
    isImporting.value = false
  }
}

const handleFileChange = (file: File) => {
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    importContent.value = e.target?.result as string || ''
    message.info(`已读取文件: ${file.name}`)
  }
  reader.onerror = () => {
    message.error('文件读取失败')
  }
  reader.readAsText(file)
}

const script = computed(() => episodeStore.currentEpisode?.script as any)
const hasEpisodes = computed(() => episodeStore.episodes.length > 0)
</script>

<template>
  <div class="script-page">
    <!-- Header -->
    <header class="script-header">
      <div class="script-header__left">
        <h2 class="script-header__title">AI编剧</h2>
        <span class="script-header__count" v-if="hasEpisodes">
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
          <NButton
            type="primary"
            @click="showExpandModal = true"
            :disabled="!selectedEpisodeId"
          >
            <template #icon>✨</template>
            AI扩写
          </NButton>
        </NSpace>
      </div>
    </header>

    <!-- Main Content -->
    <div class="script-layout">
      <!-- Episode List Sidebar -->
      <aside class="episode-sidebar">
        <div class="episode-sidebar__header">
          <span>剧本列表</span>
          <NTag size="small" round>{{ episodeStore.episodes.length }}</NTag>
        </div>

        <NScrollbar v-if="hasEpisodes" class="episode-scrollbar">
          <div
            v-for="episode in episodeStore.episodes"
            :key="episode.id"
            :class="['episode-item', { active: selectedEpisodeId === episode.id }]"
            @click="handleSelectEpisode(episode.id)"
          >
            <div class="episode-item__main">
              <span class="episode-item__title">
                {{ episode.title || `第${episode.episodeNum}集` }}
              </span>
              <span class="episode-item__num">#{{ episode.episodeNum }}</span>
            </div>
            <div class="episode-item__status">
              <StatusBadge
                :status="episode.script ? 'completed' : 'draft'"
                size="small"
              />
            </div>
          </div>
        </NScrollbar>

        <EmptyState
          v-else
          title="暂无剧本"
          description="创建第一集开始创作"
          icon=""
        >
          <template #action>
            <NButton size="small" type="primary" @click="showCreateModal = true">
              新建剧本
            </NButton>
          </template>
        </EmptyState>
      </aside>

      <!-- Script Editor -->
      <main class="script-main">
        <!-- No Episode Selected -->
        <div v-if="!selectedEpisodeId" class="script-empty">
          <EmptyState
            title="选择一集开始"
            description="从左侧列表选择剧本，或新建一集"
            icon="📝"
          />
        </div>

        <!-- Loading -->
        <div v-else-if="episodeStore.isLoading" class="script-loading">
          <NSpin size="large" />
          <p>加载中...</p>
        </div>

        <!-- No Script Generated -->
        <div v-else-if="!script" class="script-empty">
          <EmptyState
            title="剧本尚未生成"
            description="使用 AI 扩写功能，基于故事梗概生成完整剧本"
            icon="✨"
          >
            <template #action>
              <NButton type="primary" @click="showExpandModal = true">
                使用 AI 生成剧本
              </NButton>
            </template>
          </EmptyState>
        </div>

        <!-- Script Content -->
        <div v-else class="script-content">
          <!-- Script Header -->
          <div class="script-content__header">
            <div class="script-title-wrapper">
              <NInput
                v-model:value="episodeStore.currentEpisode!.title"
                placeholder="输入剧本标题"
                size="large"
                class="script-title-input"
              />
              <StatusBadge :status="script ? 'completed' : 'draft'" />
            </div>
            <NSpace>
              <NButton @click="handleSaveScript">保存修改</NButton>
            </NSpace>
          </div>

          <!-- Summary -->
          <NAlert v-if="script.summary" type="info" class="script-summary">
            <template #icon>📖</template>
            {{ script.summary }}
          </NAlert>

          <!-- Scenes -->
          <div class="scenes-section">
            <h3 class="scenes-section__title">
              <span>📼</span> 分镜场景 ({{ script.scenes?.length || 0 }})
            </h3>

            <NScrollbar x-scrollable>
              <div class="scenes-list">
                <NCollapse>
                  <NCollapseItem
                    v-for="scene in script.scenes"
                    :key="scene.sceneNum"
                    :name="scene.sceneNum"
                  >
                    <template #header>
                      <div class="scene-header">
                        <span class="scene-header__num">场景 {{ scene.sceneNum }}</span>
                        <span class="scene-header__location">{{ scene.location || '未命名' }}</span>
                      </div>
                    </template>
                    <template #header-extra>
                      <NTooltip>
                        <template #trigger>
                          <NTag
                            :type="scene.timeOfDay === '夜' ? 'warning' : 'info'"
                            size="small"
                            round
                          >
                            {{ scene.timeOfDay || '日' }}
                          </NTag>
                        </template>
                        时间：{{ scene.timeOfDay }}
                      </NTooltip>
                    </template>

                    <div class="scene-detail">
                      <!-- Characters -->
                      <div v-if="scene.characters?.length" class="scene-section">
                        <h4 class="scene-section__title">👥 角色</h4>
                        <NSpace>
                          <NTag
                            v-for="char in scene.characters"
                            :key="char"
                            size="small"
                          >
                            {{ char }}
                          </NTag>
                        </NSpace>
                      </div>

                      <!-- Description -->
                      <div v-if="scene.description" class="scene-section">
                        <h4 class="scene-section__title">📝 场景描述</h4>
                        <p class="scene-description">{{ scene.description }}</p>
                      </div>

                      <!-- Dialogues -->
                      <div v-if="scene.dialogues?.length" class="scene-section">
                        <h4 class="scene-section__title">💬 对话</h4>
                        <div class="dialogues-list">
                          <div
                            v-for="(dialogue, idx) in scene.dialogues"
                            :key="idx"
                            class="dialogue-item"
                          >
                            <span class="dialogue-character">{{ dialogue.character }}</span>
                            <span class="dialogue-content">：{{ dialogue.content }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- Actions -->
                      <div v-if="scene.actions?.length" class="scene-section">
                        <h4 class="scene-section__title">🎬 动作</h4>
                        <ul class="actions-list">
                          <li v-for="(action, idx) in scene.actions" :key="idx">
                            {{ action }}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </NCollapseItem>
                </NCollapse>
              </div>
            </NScrollbar>
          </div>
        </div>
      </main>
    </div>

    <!-- Create Episode Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="新建剧本"
      style="width: 450px"
    >
      <NForm :model="newEpisode" label-placement="top">
        <NFormItem label="集数" path="episodeNum">
          <NInputNumber
            v-model:value="newEpisode.episodeNum"
            :min="1"
            size="large"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="标题（可选）" path="title">
          <NInput
            v-model:value="newEpisode.title"
            placeholder="给这一集起个名字"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateEpisode">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Expand Script Modal -->
    <NModal
      v-model:show="showExpandModal"
      preset="card"
      title="AI 扩写剧本"
      style="width: 600px"
    >
      <NAlert type="info" class="modal-alert">
        <template #icon>💡</template>
        输入故事梗概，AI 将为你扩展为结构化的短剧剧本。越详细的梗概，生成效果越好。
      </NAlert>
      <NForm>
        <NFormItem label="故事梗概" path="summary">
          <NInput
            v-model:value="summary"
            type="textarea"
            placeholder="描述故事背景、主要情节、人物关系等..."
            :rows="6"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showExpandModal = false">取消</NButton>
          <NButton
            type="primary"
            :loading="episodeStore.isExpanding"
            @click="handleExpandScript"
          >
            开始生成
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Import Modal -->
    <NModal
      v-model:show="showImportModal"
      preset="card"
      title="导入剧本文档"
      style="width: 800px"
    >
      <NAlert type="info" class="modal-alert">
        <template #icon>📥</template>
        选择文件或粘贴完整的剧本文档，AI 将自动解析并导入。
      </NAlert>
      <NForm label-placement="top">
        <NFormItem label="选择文件">
          <NUpload
            accept=".md,.markdown,.json,.txt"
            :max-size="10 * 1024 * 1024"
            :show-file-list="false"
            @change="(options: { file: UploadFileInfo }) => handleFileChange(options.file.file as File)"
          >
            <NButton type="default" dashed>选择文件</NButton>
          </NUpload>
          <p class="file-hint">支持 .md, .json, .txt 格式，单文件不超过 10MB</p>
        </NFormItem>
        <NFormItem label="或粘贴内容">
          <NInput
            v-model:value="importContent"
            type="textarea"
            placeholder="粘贴完整的剧本文档内容..."
            :rows="12"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showImportModal = false">取消</NButton>
          <NButton
            type="primary"
            :loading="isImporting"
            @click="handleImportScript"
          >
            开始导入
          </NButton>
        </NSpace>
      </template>
    </NModal>
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

/* Episode Sidebar */
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

/* Script Main */
.script-main {
  flex: 1;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.script-empty,
.script-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.script-loading p {
  margin-top: var(--spacing-md);
  color: var(--color-text-secondary);
}

/* Script Content */
.script-content {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.script-content__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-md);
}

.script-title-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.script-title-input {
  flex: 1;
}

.script-title-input :deep(.n-input__input-el) {
  font-size: var(--font-size-xl) !important;
  font-weight: var(--font-weight-semibold);
}

.script-summary {
  margin-bottom: var(--spacing-lg);
}

/* Scenes Section */
.scenes-section {
  margin-top: var(--spacing-lg);
}

.scenes-section__title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
}

.scenes-list {
  min-width: 600px;
}

.scene-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.scene-header__num {
  font-weight: var(--font-weight-semibold);
}

.scene-header__location {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.scene-detail {
  padding: var(--spacing-sm) 0;
}

.scene-section {
  margin-bottom: var(--spacing-md);
}

.scene-section__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.scene-description {
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  background: var(--color-bg-gray);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

.dialogues-list {
  background: var(--color-bg-gray);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

.dialogue-item {
  margin-bottom: var(--spacing-sm);
  line-height: var(--line-height-relaxed);
}

.dialogue-item:last-child {
  margin-bottom: 0;
}

.dialogue-character {
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.dialogue-content {
  color: var(--color-text-primary);
}

.actions-list {
  background: var(--color-bg-gray);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin: 0;
}

.actions-list li {
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.actions-list li:last-child {
  margin-bottom: 0;
}

/* Modal */
.modal-alert {
  margin-bottom: var(--spacing-lg);
}

.file-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-sm);
}
</style>
