<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NSpace, NUpload, NInput, NResult, NSpin, NText, NAlert } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { importProject, getImportTaskStatus } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const router = useRouter()
const fileContent = ref('')
const isImporting = ref(false)
const importResult = ref<any>(null)
const errorMsg = ref('')
const currentTaskId = ref<string | null>(null)
const taskStatus = ref<'pending' | 'processing' | 'completed' | 'failed'>('pending')
let pollTimer: ReturnType<typeof setInterval> | null = null

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
  <div class="import-page">
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
            <NButton type="primary" @click="handleImport">
              开始导入
            </NButton>
          </NSpace>
        </div>
      </NCard>

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
.import-page {
  min-height: 100vh;
  padding: var(--spacing-2xl);
  background: var(--color-bg-base);
}

.import-container {
  max-width: 700px;
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
</style>
