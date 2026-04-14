<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NSelect,
  NAlert,
  NSteps,
  NStep,
  NSpin,
  NTag,
  NProgress,
  useMessage
} from 'naive-ui'
import {
  executePipeline,
  getPipelineJob,
  getPipelineStatus,
  type PipelineJob
} from '@/api'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const projectId = computed(() => route.params.id as string)

// Pipeline state
const isRunning = ref(false)
const currentJob = ref<PipelineJob | null>(null)
const error = ref<string | null>(null)

// Input state
const showInputModal = ref(true)
const idea = ref('')
const isExecuting = ref(false)

// Options
const defaultAspectRatio = ref<'16:9' | '9:16' | '1:1'>('9:16')
const defaultResolution = ref<'480p' | '720p'>('720p')

// Polling
let pollInterval: ReturnType<typeof setInterval> | null = null

// Pipeline steps
const steps = [
  { id: 'script-writing', label: '剧本生成', description: 'DeepSeek AI' },
  { id: 'episode-split', label: '智能分集', description: '起承转合' },
  { id: 'segment-extract', label: '分镜提取', description: '角色/场景/动作' },
  { id: 'storyboard', label: '分镜生成', description: '提示词' }
]

// Current step index
const currentStepIndex = computed(() => {
  if (!currentJob.value) return -1
  const idx = steps.findIndex(s => s.id === currentJob.value?.currentStep)
  return idx >= 0 ? idx : 0
})

// Step statuses from job results（NStep status：wait | process | finish | error）
const stepStatuses = computed((): Array<'wait' | 'process' | 'finish' | 'error'> => {
  if (!currentJob.value?.stepResults) return steps.map(() => 'wait')
  return steps.map((step) => {
    const result = currentJob.value?.stepResults?.find((r) => r.step === step.id)
    const s = result?.status || 'pending'
    const map: Record<string, 'wait' | 'process' | 'finish' | 'error'> = {
      pending: 'wait',
      processing: 'process',
      completed: 'finish',
      failed: 'error'
    }
    return map[s] ?? 'wait'
  })
})

onMounted(async () => {
  // Check if there's a previous running or completed job
  try {
    const result = await getPipelineStatus(projectId.value)
    if (result.data && result.data.status !== 'not_started') {
      const jobId = (result.data as any).id
      if (jobId) {
        const jobResult = await getPipelineJob(jobId)
        if (jobResult.data) {
          currentJob.value = jobResult.data
          if (jobResult.data.status === 'running') {
            startPolling()
            showInputModal.value = false
          } else if (jobResult.data.status === 'completed') {
            showInputModal.value = false
            message.success('流水线已完成')
          }
        }
      }
    }
  } catch (e) {
    // No previous run
  }
})

onUnmounted(() => {
  stopPolling()
})

const startPolling = () => {
  if (pollInterval) return
  isRunning.value = true
  pollInterval = setInterval(async () => {
    if (!currentJob.value) {
      stopPolling()
      return
    }
    try {
      const result = await getPipelineJob(currentJob.value.id)
      if (result.data) {
        currentJob.value = result.data
        if (result.data.status === 'completed') {
          message.success('流水线执行完成！')
          stopPolling()
          isRunning.value = false
        } else if (result.data.status === 'failed') {
          error.value = result.data.error || '流水线执行失败'
          message.error(error.value ?? '流水线执行失败')
          stopPolling()
          isRunning.value = false
        }
      }
    } catch (e) {
      console.error('Polling error:', e)
    }
  }, 2000) // Poll every 2 seconds
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  isRunning.value = false
}

const executePipelineAsync = async () => {
  if (!idea.value.trim()) {
    message.warning('请输入剧本想法')
    return
  }

  isExecuting.value = true
  error.value = null

  try {
    const result = await executePipeline({
      projectId: projectId.value,
      idea: idea.value,
      defaultAspectRatio: defaultAspectRatio.value,
      defaultResolution: defaultResolution.value
    })

    if (result.success && result.data) {
      currentJob.value = {
        id: result.data.jobId,
        projectId: projectId.value,
        status: 'pending',
        currentStep: 'script-writing',
        progress: 0,
        stepResults: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as PipelineJob
      showInputModal.value = false
      startPolling()
      message.info('流水线已启动，正在后台执行...')
    } else {
      throw new Error(result.error || '启动失败')
    }
  } catch (e: any) {
    const msg = e?.message || '执行失败'
    error.value = msg
    message.error(msg)
  } finally {
    isExecuting.value = false
  }
}

const goToProjectDetail = () => {
  router.push(`/project/${projectId.value}`)
}
</script>

<template>
  <div class="pipeline-container">
    <NCard title="AI 短剧生产流水线">
      <template #header-extra>
        <NSpace>
          <NTag type="info">Seedance 2.0</NTag>
        </NSpace>
      </template>

      <!-- Input Modal -->
      <NModal
        v-model:show="showInputModal"
        preset="card"
        title="启动流水线"
        style="width: 600px"
        :mask-closable="false"
      >
        <NForm label-placement="top">
          <NFormItem label="剧本想法">
            <NInput
              v-model:value="idea"
              type="textarea"
              placeholder="描述你的短剧想法，例如：&#10;一个现代都市女孩意外穿越到古代，遇到了冷面王爷..."
              :rows="4"
            />
          </NFormItem>

          <NFormItem label="视频参数">
            <NSpace>
              <NInputGroup>
                <NInputGroupLabel>比例</NInputGroupLabel>
                <NSelect
                  v-model:value="defaultAspectRatio"
                  :options="[
                    { label: '9:16 竖屏', value: '9:16' },
                    { label: '16:9 横屏', value: '16:9' },
                    { label: '1:1 方形', value: '1:1' }
                  ]"
                  style="width: 120px"
                />
              </NInputGroup>
              <NInputGroup>
                <NInputGroupLabel>分辨率</NInputGroupLabel>
                <NSelect
                  v-model:value="defaultResolution"
                  :options="[
                    { label: '720p 高清', value: '720p' },
                    { label: '480p 标清', value: '480p' }
                  ]"
                  style="width: 120px"
                />
              </NInputGroup>
            </NSpace>
          </NFormItem>

          <NAlert type="info" title="流水线说明">
            <template #icon>
              <span>ℹ️</span>
            </template>
            <template #header>流程说明</template>
            1. DeepSeek 生成专业剧本<br/>
            2. 智能分集（起承转合）<br/>
            3. 提取角色、场景、动作<br/>
            4. 生成分镜提示词
          </NAlert>
        </NForm>

        <template #footer>
          <NSpace justify="end">
            <NButton type="primary" @click="executePipelineAsync" :loading="isExecuting">
              开始执行
            </NButton>
          </NSpace>
        </template>
      </NModal>

      <!-- Running State with Progress -->
      <div v-if="isRunning && currentJob" class="running-state">
        <NProgress
          type="line"
          :percentage="currentJob.progress"
          :indicator-text-color="'#18a058'"
          processing
        />
        <div class="steps-progress">
          <NSteps :current="currentStepIndex" size="small" vertical>
            <NStep
              v-for="(step, index) in steps"
              :key="step.id"
              :title="step.label"
              :description="step.description"
              :status="stepStatuses[index]"
            />
          </NSteps>
        </div>
        <NSpin v-if="currentJob.progress < 100">
          <template #description>
            <p>正在执行：{{ steps[currentStepIndex]?.label }}</p>
          </template>
        </NSpin>
      </div>

      <!-- Error State -->
      <NAlert v-if="error" type="error" title="执行失败" closable @close="error = null">
        {{ error }}
      </NAlert>

      <!-- Completed State -->
      <div v-if="currentJob?.status === 'completed' && !isRunning" class="completed-state">
        <NAlert type="success" title="流水线执行完成">
          <template #icon>
            <span>✅</span>
          </template>
          数据已保存到项目中，包括：剧本、分集、角色、场地和分镜。
        </NAlert>

        <NCard title="执行结果" class="results-card">
          <NSpace vertical>
            <div v-for="result in currentJob.stepResults" :key="result.step" class="step-result">
              <NTag :type="result.status === 'completed' ? 'success' : 'error'">
                {{ result.step }}
              </NTag>
              <span class="step-status">
                {{ result.status === 'completed' ? '已完成' : result.status }}
              </span>
            </div>
          </NSpace>
        </NCard>

        <NSpace justify="center" class="actions">
          <NButton @click="showInputModal = true">重新执行</NButton>
          <NButton type="primary" @click="goToProjectDetail">查看项目详情</NButton>
        </NSpace>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-if="!isRunning && !currentJob"
        icon="🎬"
        title="AI 短剧流水线"
        description="从想法到 Seedance 视频参数，一站式完成"
      >
        <template #action>
          <NButton type="primary" @click="showInputModal = true">
            启动流水线
          </NButton>
        </template>
      </EmptyState>
    </NCard>
  </div>
</template>

<style scoped>
.pipeline-container {
  padding: 20px;
}

.running-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.steps-progress {
  margin: 30px 0;
  max-width: 400px;
  width: 100%;
}

.completed-state {
  padding: 20px 0;
}

.results-card {
  margin-top: 20px;
}

.step-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.step-status {
  color: #666;
}

.actions {
  margin-top: 24px;
}
</style>
