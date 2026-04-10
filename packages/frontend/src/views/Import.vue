<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NSpace, NUpload, NInput, NResult, NSpin, NText } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { importProject, getImportTaskStatus } from '@/api'

const router = useRouter()
const fileContent = ref('')
const isImporting = ref(false)
const importResult = ref<any>(null)
const errorMsg = ref('')
const currentTaskId = ref<string | null>(null)
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
  pollTimer = setInterval(async () => {
    try {
      const task = await getImportTaskStatus(taskId)
      if (task.status === 'completed') {
        stopPolling()
        importResult.value = task.result
        isImporting.value = false
      } else if (task.status === 'failed') {
        stopPolling()
        errorMsg.value = task.errorMsg || '导入失败'
        isImporting.value = false
      }
      // else pending/processing, continue polling
    } catch (error: any) {
      stopPolling()
      errorMsg.value = error?.response?.data?.message || '查询任务状态失败'
      isImporting.value = false
    }
  }, 2000) // poll every 2 seconds
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
    // Start polling for task status
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
}

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="import-container">
    <div class="import-header">
      <h1>导入项目</h1>
      <p class="subtitle">导入短剧剧本，自动创建项目并解析结构</p>
    </div>

    <NCard v-if="!importResult" class="import-card">
      <template v-if="isImporting">
        <div class="importing-section">
          <NSpin size="large" />
          <p class="importing-text">AI 正在解析文档...</p>
          <p class="importing-hint">大文档可能需要较长时间，请耐心等待</p>
        </div>
      </template>
      <template v-else>
        <div class="upload-section">
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
          <NText depth="3" style="margin-top: 8px">支持 .md, .txt, .json 格式</NText>
        </div>

        <div class="divider">
          <span>或</span>
        </div>

        <div class="paste-section">
          <NInput
            v-model:value="fileContent"
            type="textarea"
            placeholder="粘贴剧本文档内容..."
            :rows="12"
            @input="errorMsg = ''"
          />
        </div>

        <div v-if="errorMsg" class="error-msg">
          {{ errorMsg }}
        </div>

        <div class="action-section">
          <NSpace justify="end">
            <NButton @click="router.push('/projects')">取消</NButton>
            <NButton type="primary" @click="handleImport">
              开始导入
            </NButton>
          </NSpace>
        </div>
      </template>
    </NCard>

    <NCard v-else class="result-card">
      <NResult
        status="success"
        title="导入成功"
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
  </div>
</template>

<style scoped>
.import-container {
  min-height: 100vh;
  padding: 48px 24px;
  background: #f5f5f5;
}

.import-header {
  text-align: center;
  margin-bottom: 32px;
}

.import-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.import-card {
  max-width: 700px;
  margin: 0 auto;
}

.upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: #999;
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #eee;
}

.divider {
  gap: 16px;
}

.paste-section {
  margin-bottom: 16px;
}

.error-msg {
  color: #d03050;
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

.action-section {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.result-card {
  max-width: 500px;
  margin: 0 auto;
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #18a058;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

.importing-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
}

.importing-text {
  margin-top: 16px;
  font-size: 16px;
  color: #333;
}

.importing-hint {
  margin-top: 8px;
  font-size: 14px;
  color: #999;
}
</style>
