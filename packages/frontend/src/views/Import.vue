<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NSpace, NUpload, NInput, NResult, NSpin, NText, NAlert, NModal, NDescriptions, NDescriptionsItem, NTag, NCollapse, NCollapseItem } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { importProject, getImportTaskStatus, previewImport, type PreviewResult } from '@/api'
import StatusBadge from '@/components/StatusBadge.vue'

const router = useRouter()
const fileContent = ref('')
const isImporting = ref(false)
const isPreviewing = ref(false)
const importResult = ref<any>(null)
const errorMsg = ref('')
const currentTaskId = ref<string | null>(null)
const taskStatus = ref<'pending' | 'processing' | 'completed' | 'failed'>('pending')
let pollTimer: ReturnType<typeof setInterval> | null = null

const showPreviewModal = ref(false)
const previewData = ref<PreviewResult | null>(null)

const handleFileChange = (options: { file: UploadFileInfo }) => {
  const file = options.file.file
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    fileContent.value = e.target?.result as string
    errorMsg.value = ''
    importResult.value = null
  }
  reader.readAsText(file)
}

const startPolling = (taskId: string) => {
  currentTaskId.value = taskId
  taskStatus.value = 'pending'
  pollTimer = setInterval(async () => {
    try {
      const task = await getImportTaskStatus(taskId)
      taskStatus.value = task.status

      if (task.status === 'completed') {
        stopPolling()
        importResult.value = task.result
        isImporting.value = false
      } else if (task.status === 'failed') {
        stopPolling()
        errorMsg.value = task.errorMsg || '导入失败'
        isImporting.value = false
      }
    } catch (error: any) {
      stopPolling()
      errorMsg.value = error?.response?.data?.message || '查询任务状态失败'
      isImporting.value = false
    }
  }, 2000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const handlePreview = async () => {
  if (!fileContent.value.trim()) {
    errorMsg.value = '请选择或粘贴文档内容'
    return
  }

  isPreviewing.value = true
  errorMsg.value = ''

  try {
    previewData.value = await previewImport(fileContent.value, 'markdown')
    showPreviewModal.value = true
  } catch (error: any) {
    errorMsg.value = error?.response?.data?.message || error.message || '预览失败'
  } finally {
    isPreviewing.value = false
  }
}

const handleImport = async () => {
  if (!fileContent.value.trim()) {
    errorMsg.value = '请选择或粘贴文档内容'
    return
  }

  isImporting.value = true
  errorMsg.value = ''
  importResult.value = null

  try {
    const result = await importProject(fileContent.value, 'markdown')
    startPolling(result.taskId)
  } catch (error: any) {
    errorMsg.value = error?.response?.data?.message || error.message || '导入失败'
    isImporting.value = false
  }
}

const confirmImport = () => {
  showPreviewModal.value = false
  handleImport()
}

const goToProject = () => {
  if (importResult.value?.projectId) {
    router.push(`/project/${importResult.value.projectId}`)
  }
}

const handleReset = () => {
  fileContent.value = ''
  importResult.value = null
  errorMsg.value = ''
  stopPolling()
  currentTaskId.value = null
  taskStatus.value = 'pending'
}

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="import-page page-shell page-shell--narrow">
    <div class="import-container">
      <!-- Header -->
      <header class="import-header">
        <h1>导入项目</h1>
        <p class="import-subtitle">导入短剧剧本，AI 自动解析并创建项目</p>
      </header>

      <!-- Loading State -->
      <NCard v-if="isImporting" class="import-card">
        <div class="importing-section">
          <NSpin size="large" />
          <h3 class="importing-title">AI 正在解析文档...</h3>
          <p class="importing-hint">
            <StatusBadge :status="taskStatus" />
            <span v-if="taskStatus === 'pending'">等待处理</span>
            <span v-else-if="taskStatus === 'processing'">解析中，请稍候</span>
          </p>
        </div>
      </NCard>

      <!-- Success Result -->
      <NCard v-else-if="importResult" class="result-card">
        <NResult
          status="success"
          title="导入成功！"
          :description="`已创建项目：${importResult.projectName}`"
        >
          <template #footer>
            <NSpace justify="center">
              <NButton @click="handleReset">继续导入</NButton>
              <NButton type="primary" @click="goToProject">前往项目</NButton>
            </NSpace>
          </template>
        </NResult>

        <div class="result-stats">
          <div class="stat-item">
            <span class="stat-value">{{ importResult.episodesCreated || 0 }}</span>
            <span class="stat-label">集</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ importResult.charactersCreated || 0 }}</span>
            <span class="stat-label">角色</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ importResult.scenesCreated || 0 }}</span>
            <span class="stat-label">场景</span>
          </div>
        </div>
      </NCard>

      <!-- Import Form -->
      <NCard v-else class="import-card">
        <!-- Error Alert -->
        <NAlert v-if="errorMsg" type="error" class="error-alert">
          {{ errorMsg }}
        </NAlert>

        <!-- Upload Section -->
        <div class="upload-section">
          <div class="upload-section__icon">📄</div>
          <NUpload
            accept=".md,.txt,.json"
            :max="1"
            @change="handleFileChange"
            @remove="handleReset"
          >
            <NButton type="primary" size="large">
              选择文件
            </NButton>
          </NUpload>
          <NText depth="3" class="upload-hint">支持 .md, .txt, .json 格式</NText>
        </div>

        <div class="divider">
          <span>或者</span>
        </div>

        <!-- Paste Section -->
        <div class="paste-section">
          <NInput
            v-model:value="fileContent"
            type="textarea"
            placeholder="粘贴剧本文档内容..."
            :rows="10"
            @input="errorMsg = ''"
          />
        </div>

        <!-- Action Section -->
        <div class="action-section">
          <NSpace justify="end">
            <NButton @click="router.push('/projects')">取消</NButton>
            <NButton @click="handlePreview" :loading="isPreviewing" :disabled="!fileContent.trim()">
              预览
            </NButton>
            <NButton type="primary" @click="handleImport" :disabled="!fileContent.trim()">
              开始导入
            </NButton>
          </NSpace>
        </div>
      </NCard>

      <!-- Preview Modal -->
      <NModal
        v-model:show="showPreviewModal"
        preset="card"
        title="导入预览"
        style="max-width: 700px;"
      >
        <div v-if="previewData" class="preview-content">
          <NAlert type="info" class="preview-alert">
            AI 解析预览，实际导入结果可能略有差异。预计 AI 成本：¥{{ previewData.aiCost.toFixed(4) }}
          </NAlert>

          <NDescriptions label-placement="top" bordered>
            <NDescriptionsItem label="项目名称">
              {{ previewData.preview.projectName || '未命名项目' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="项目描述">
              {{ previewData.preview.description || '无' }}
            </NDescriptionsItem>
          </NDescriptions>

          <div class="preview-section">
            <h4>角色列表 ({{ previewData.preview.characters.length }}个)</h4>
            <div class="character-tags">
              <NTag v-for="char in previewData.preview.characters" :key="char" size="small">
                {{ char }}
              </NTag>
            </div>
          </div>

          <div class="preview-section">
            <h4>集数 ({{ previewData.preview.episodes.length }}集)</h4>
            <NCollapse>
              <NCollapseItem
                v-for="ep in previewData.preview.episodes"
                :key="ep.episodeNum"
                :title="`第${ep.episodeNum}集：${ep.title}`"
                :name="ep.episodeNum"
              >
                <template #header-extra>
                  {{ ep.sceneCount }} 个场景
                </template>
                <div v-for="scene in ep.scenes" :key="scene.sceneNum" class="scene-item">
                  <span class="scene-num">场景 {{ scene.sceneNum }}</span>
                  <span class="scene-desc">{{ scene.description }}</span>
                </div>
                <div v-if="ep.sceneCount > 3" class="scene-more">
                  还有 {{ ep.sceneCount - 3 }} 个场景...
                </div>
              </NCollapseItem>
            </NCollapse>
          </div>
        </div>

        <template #footer>
          <NSpace justify="end">
            <NButton @click="showPreviewModal = false">取消</NButton>
            <NButton type="primary" @click="confirmImport">
              确认导入
            </NButton>
          </NSpace>
        </template>
      </NModal>

      <!-- Help Section -->
      <div class="import-help">
        <h4>导入说明</h4>
        <ul>
          <li>支持 Markdown、JSON 格式的剧本文档</li>
          <li>文档应包含剧本标题、角色列表、集数及场景描述</li>
          <li>AI 将自动识别并创建对应的项目结构</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-container {
  width: 100%;
  margin: 0 auto;
}

.import-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.import-header h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.import-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.import-card,
.result-card {
  margin-bottom: var(--spacing-lg);
}

/* Upload Section */
.upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl);
  background: var(--color-bg-gray);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
}

.upload-section__icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
}

.upload-hint {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin: var(--spacing-lg) 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

/* Paste Section */
.paste-section {
  margin-bottom: var(--spacing-md);
}

/* Action Section */
.action-section {
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

/* Error Alert */
.error-alert {
  margin-bottom: var(--spacing-lg);
}

/* Importing Section */
.importing-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-2xl);
}

.importing-title {
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.importing-hint {
  margin-top: var(--spacing-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* Result Stats */
.result-stats {
  display: flex;
  justify-content: center;
  gap: var(--spacing-2xl);
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--color-border-light);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 36px;
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

/* Help Section */
.import-help {
  margin-top: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
}

.import-help h4 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.import-help ul {
  margin: 0;
  padding-left: var(--spacing-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.import-help li {
  margin-bottom: var(--spacing-xs);
}

.import-help li:last-child {
  margin-bottom: 0;
}

/* Preview Modal */
.preview-content {
  max-height: 60vh;
  overflow-y: auto;
}

.preview-alert {
  margin-bottom: var(--spacing-lg);
}

.preview-section {
  margin-top: var(--spacing-lg);
}

.preview-section h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
}

.character-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.scene-item {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.scene-item:last-child {
  border-bottom: none;
}

.scene-num {
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
  min-width: 70px;
}

.scene-desc {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.scene-more {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  padding-top: var(--spacing-xs);
}
</style>
