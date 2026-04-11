<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NCard, NButton, NSpace, NTag, NResult,
  useMessage
} from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { api, createOutlineJob, pollOutlineJob } from '@/api'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()

const isLoading = ref(true)
const generatingStatus = ref('')
const outline = ref<any>(null)
const selectedStyle = ref<string>('cinematic')
const isStarting = ref(false)
const error = ref<string | null>(null)

const styleOptions = [
  { label: '真人写实', value: 'realistic' },
  { label: '电影风格', value: 'cinematic' },
  { label: '复古调色', value: 'vintage' }
]

onMounted(async () => {
  const idea = route.query.idea as string
  if (!idea) {
    router.replace('/projects')
    return
  }

  try {
    // 创建异步job
    const { jobId } = await createOutlineJob(idea)

    // 轮询等待结果
    const result = await pollOutlineJob(
      jobId,
      (status) => {
        generatingStatus.value = status === 'pending' ? '等待开始...' : 'AI 创作中...'
      }
    )

    outline.value = result?.outline
  } catch (e: any) {
    error.value = e.message || '生成大纲失败'
  } finally {
    isLoading.value = false
  }
})

const handleStart = async () => {
  if (!outline.value) return

  isStarting.value = true
  try {
    // 创建项目
    const project = await projectStore.createProject({
      name: outline.value.title || `短剧 ${new Date().toLocaleDateString('zh-CN')}`,
      description: outline.value.summary || ''
    })

    // 更新风格
    await api.put(`/projects/${project.id}`, {
      visualStyle: [selectedStyle.value]
    })

    // 跳转 Pipeline
    router.push(`/project/${project.id}/pipeline?idea=${encodeURIComponent(route.query.idea as string)}`)
  } catch (e: any) {
    message.error(e.message || '启动失败')
  } finally {
    isStarting.value = false
  }
}

const handleBack = () => {
  router.push('/projects')
}
</script>

<template>
  <div class="generate-page">
    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>{{ generatingStatus || 'AI 正在生成剧本大纲...' }}</p>
    </div>

    <!-- Error -->
    <NCard v-else-if="error" class="error-card">
      <NResult status="error" title="生成失败" :description="error">
        <template #footer>
          <NSpace>
            <NButton @click="handleBack">返回</NButton>
            <NButton type="primary" @click="() => window.location.reload()">重试</NButton>
          </NSpace>
        </template>
      </NResult>
    </NCard>

    <!-- Outline Ready -->
    <div v-else-if="outline" class="outline-container">
      <h1 class="page-title">✨ 剧本大纲已生成</h1>

      <NCard class="outline-card">
        <div class="outline-header">
          <h2>{{ outline.title }}</h2>
          <NTag type="info">{{ outline.metadata?.genre }}</NTag>
        </div>

        <p class="outline-summary">{{ outline.summary }}</p>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">风格</span>
            <span class="meta-value">{{ outline.metadata?.style }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">基调</span>
            <span class="meta-value">{{ outline.metadata?.tone }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">场景数</span>
            <span class="meta-value">{{ outline.sceneCount }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">推荐集数</span>
            <span class="meta-value">{{ outline.metadata?.recommendedEpisodes }}</span>
          </div>
        </div>
      </NCard>

      <NCard class="style-card">
        <p class="style-title">选择视频风格</p>
        <div class="style-list">
          <div
            v-for="opt in styleOptions"
            :key="opt.value"
            class="style-item"
            :class="{ active: selectedStyle === opt.value }"
            @click="selectedStyle = opt.value"
          >
            {{ opt.label }}
          </div>
        </div>
      </NCard>

      <div class="actions">
        <NButton @click="handleBack">取消</NButton>
        <NButton type="primary" size="large" @click="handleStart" :loading="isStarting">
          进入流水线 →
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.generate-page {
  min-height: 100vh;
  padding: var(--spacing-xl);
  background: var(--color-bg-base);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--spacing-lg);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-card {
  max-width: 480px;
  margin: 100px auto;
}

.outline-container {
  max-width: 600px;
  margin: 0 auto;
}

.page-title {
  text-align: center;
  font-size: var(--font-size-2xl);
  margin-bottom: var(--spacing-xl);
}

.outline-card {
  margin-bottom: var(--spacing-md);
}

.outline-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.outline-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
}

.outline-summary {
  color: var(--color-text-secondary);
  line-height: 1.8;
  margin-bottom: var(--spacing-md);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.meta-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-base);
  border-radius: var(--radius-sm);
}

.meta-label {
  color: var(--color-text-tertiary);
}

.meta-value {
  font-weight: 500;
}

.style-card {
  margin-bottom: var(--spacing-lg);
}

.style-title {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
}

.style-list {
  display: flex;
  gap: var(--spacing-sm);
}

.style-item {
  padding: var(--spacing-md) var(--spacing-xl);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.style-item:hover {
  border-color: var(--color-primary);
}

.style-item.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.actions {
  display: flex;
  justify-content: space-between;
}
</style>
