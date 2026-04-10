<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput, NSelect, NSpin, NAlert, NCollapse, NCollapseItem, NTag, NUpload, useMessage, type UploadFileInfo } from 'naive-ui'
import { useEpisodeStore } from '@/stores/episode'
import { importScript } from '@/api'

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
  }
}

const handleSaveScript = async () => {
  if (!selectedEpisodeId.value || !episodeStore.currentEpisode) return
  await episodeStore.updateEpisode(selectedEpisodeId.value, {
    title: episodeStore.currentEpisode.title || undefined,
    script: episodeStore.currentEpisode.script as any
  })
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
    // 刷新剧本列表
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
</script>

<template>
  <div class="script-container">
    <NCard title="AI编剧">
      <template #header-extra>
        <NSpace>
          <NButton @click="showImportModal = true">导入文档</NButton>
          <NButton @click="showCreateModal = true">新建剧本</NButton>
          <NButton type="primary" @click="showExpandModal = true" :disabled="!selectedEpisodeId">
            AI扩写
          </NButton>
        </NSpace>
      </template>

      <div class="script-layout">
        <!-- Episode List -->
        <div class="episode-list">
          <div class="episode-list-header">
            <span>剧本列表</span>
          </div>
          <div v-if="episodeStore.episodes.length === 0" class="episode-empty">
            暂无剧本，请新建
          </div>
          <div
            v-for="episode in episodeStore.episodes"
            :key="episode.id"
            :class="['episode-item', { active: selectedEpisodeId === episode.id }]"
            @click="handleSelectEpisode(episode.id)"
          >
            <span class="episode-title">{{ episode.title || `第${episode.episodeNum}集` }}</span>
            <NTag v-if="episode.script" size="small" type="success">已生成</NTag>
          </div>
        </div>

        <!-- Script Editor -->
        <div class="script-editor">
          <div v-if="!selectedEpisodeId" class="no-episode">
            <NEmpty description="请先选择或创建一个剧本">
              <template #extra>
                <NButton type="primary" @click="showCreateModal = true">新建剧本</NButton>
              </template>
            </NEmpty>
          </div>

          <div v-else-if="episodeStore.isLoading" class="loading">
            <NSpin size="large" />
          </div>

          <div v-else-if="!script" class="no-script">
            <NEmpty description="剧本尚未生成">
              <template #extra>
                <NButton type="primary" @click="showExpandModal = true">使用AI生成剧本</NButton>
              </template>
            </NEmpty>
          </div>

          <div v-else class="script-content">
            <div class="script-header">
              <NInput
                v-model:value="episodeStore.currentEpisode!.title"
                placeholder="剧本标题"
                class="script-title-input"
                size="large"
              />
              <NButton type="primary" @click="handleSaveScript">保存</NButton>
            </div>

            <NAlert v-if="script.summary" type="info" class="script-summary">
              {{ script.summary }}
            </NAlert>

            <div class="scenes-list">
              <NCollapse>
                <NCollapseItem
                  v-for="scene in script.scenes"
                  :key="scene.sceneNum"
                  :title="`场景 ${scene.sceneNum}: ${scene.location || '未命名'}`"
                  :name="scene.sceneNum"
                >
                  <template #header-extra>
                    <NTag :type="scene.timeOfDay === '夜' ? 'warning' : 'info'" size="small">
                      {{ scene.timeOfDay }}
                    </NTag>
                  </template>

                  <div class="scene-detail">
                    <div class="scene-info">
                      <p><strong>地点：</strong>{{ scene.location }}</p>
                      <p><strong>角色：</strong>{{ scene.characters?.join(', ') || '无' }}</p>
                    </div>

                    <div class="scene-description">
                      <strong>场景描述：</strong>
                      <p>{{ scene.description }}</p>
                    </div>

                    <div v-if="scene.dialogues?.length" class="scene-dialogues">
                      <strong>对话：</strong>
                      <div v-for="(dialogue, idx) in scene.dialogues" :key="idx" class="dialogue-item">
                        <span class="dialogue-character">{{ dialogue.character }}：</span>
                        <span class="dialogue-content">{{ dialogue.content }}</span>
                      </div>
                    </div>

                    <div v-if="scene.actions?.length" class="scene-actions">
                      <strong>动作：</strong>
                      <ul>
                        <li v-for="(action, idx) in scene.actions" :key="idx">{{ action }}</li>
                      </ul>
                    </div>
                  </div>
                </NCollapseItem>
              </NCollapse>
            </div>
          </div>
        </div>
      </div>
    </NCard>

    <!-- Create Episode Modal -->
    <NModal v-model:show="showCreateModal" preset="card" title="新建剧本" style="width: 450px">
      <NForm :model="newEpisode">
        <NFormItem label="集数" path="episodeNum">
          <NInputNumber v-model:value="newEpisode.episodeNum" :min="1" />
        </NFormItem>
        <NFormItem label="标题（可选）" path="title">
          <NInput v-model:value="newEpisode.title" placeholder="如：第1集 天工开物" />
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
    <NModal v-model:show="showExpandModal" preset="card" title="AI扩写剧本" style="width: 600px">
      <NAlert type="info" class="expand-info">
        输入故事梗概，AI将为你扩展为结构化的短剧剧本。越详细的梗概，生成效果越好。
      </NAlert>
      <NForm>
        <NFormItem label="故事梗概" path="summary">
          <NInput
            v-model:value="summary"
            type="textarea"
            placeholder="例如：主角意外穿越到明朝，成为宋应星的后人。他凭借现代知识，在天工开物的启发下，发明了一系列超前技术，最终成为一代工部尚书..."
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

    <!-- Import Script Modal -->
    <NModal v-model:show="showImportModal" preset="card" title="导入剧本文档" style="width: 800px">
      <NAlert type="info" class="expand-info">
        选择文件或粘贴完整的剧本文档（支持 Markdown 或 JSON 格式），AI 将自动解析并导入到项目中。
      </NAlert>
      <NForm>
        <NFormItem label="选择文件" path="file">
          <NUpload
            accept=".md,.markdown,.json,.txt"
            :max-size="10 * 1024 * 1024"
            :show-file-list="false"
            @change="(options: { file: UploadFileInfo }) => handleFileChange(options.file.file as File)"
          >
            <NButton type="primary" dashed>选择文件</NButton>
          </NUpload>
          <div class="file-hint">支持 .md, .json, .txt 格式，单文件不超过 10MB</div>
        </NFormItem>
        <NFormItem label="剧本内容" path="content">
          <NInput
            v-model:value="importContent"
            type="textarea"
            placeholder="或直接粘贴完整的剧本文档内容..."
            :rows="15"
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
.script-container {
  height: 100%;
}

.script-container :deep(.n-card) {
  height: 100%;
}

.script-container :deep(.n-card__content) {
  padding: 0;
}

.script-layout {
  display: flex;
  height: calc(100vh - 200px);
}

.episode-list {
  width: 200px;
  border-right: 1px solid #f0f0f0;
  background: #fafafa;
}

.episode-list-header {
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}

.episode-empty {
  padding: 16px;
  color: #999;
  font-size: 13px;
}

.episode-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.episode-item:hover {
  background: #f0f0f0;
}

.episode-item.active {
  background: #e6f4ff;
  border-right: 2px solid #1890ff;
}

.episode-title {
  font-size: 14px;
}

.script-editor {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.no-episode,
.no-script {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.script-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.script-title-input {
  flex: 1;
}

.script-summary {
  margin-bottom: 20px;
}

.scenes-list {
  margin-top: 20px;
}

.scene-detail {
  padding: 8px 0;
}

.scene-info {
  margin-bottom: 12px;
  color: #666;
}

.scene-info p {
  margin: 4px 0;
}

.scene-description {
  margin-bottom: 12px;
}

.scene-description p {
  margin-top: 4px;
  color: #333;
}

.scene-dialogues {
  margin-bottom: 12px;
}

.dialogue-item {
  padding: 4px 0;
}

.dialogue-character {
  font-weight: 600;
  color: #1890ff;
}

.dialogue-content {
  color: #333;
}

.scene-actions ul {
  margin-top: 4px;
  padding-left: 20px;
}

.scene-actions li {
  color: #333;
  margin: 2px 0;
}

.expand-info {
  margin-bottom: 16px;
}

.file-hint {
  color: #999;
  font-size: 12px;
  margin-top: 8px;
}
</style>
