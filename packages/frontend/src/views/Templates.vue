<template>
  <div class="templates-page">
    <div class="page-header">
      <h1>爆款模板库</h1>
      <p class="subtitle">选择一套短剧基因模板，AI 帮你生成 40 集大纲</p>
    </div>

    <div class="templates-grid">
      <div
        v-for="template in builtinTemplates"
        :key="template.id"
        class="template-card"
        :class="{ selected: selectedTemplate?.id === template.id }"
        @click="selectTemplate(template)"
      >
        <div class="template-badge">{{ template.category }}</div>
        <h3 class="template-name">{{ template.name }}</h3>
        <p class="template-desc">{{ template.description }}</p>
        <div class="template-structure">
          <div v-for="(act, idx) in template.structure.acts" :key="idx" class="act-item">
            <span class="act-label">{{ act.name }}</span>
            <span class="act-range">{{ act.episodes }}集</span>
          </div>
        </div>
        <div class="template-paywall">
          <NTag size="small" type="warning"
            >付费点：第{{ template.structure.paywallEpisodes.join('、') }}集</NTag
          >
        </div>
      </div>
    </div>

    <!-- 生成进度遮罩 -->
    <div v-if="generating" class="generate-overlay">
      <div class="generate-modal">
        <div class="generate-spinner" />
        <div class="generate-title">AI 正在构思大纲...</div>
        <div class="generate-status">{{ generateStatus }}</div>
        <NProgress :percentage="generateProgress" :show-indicator="false" type="line" />
        <div class="generate-hint">预计需要 30-60 秒，请稍候</div>
      </div>
    </div>

    <!-- 生成大纲表单模态框 -->
    <NModal
      v-model:show="showFormModal"
      :mask-closable="!generating"
      preset="card"
      title="填写核心设定"
      style="width: 520px; max-width: 90vw"
      :closable="!generating"
      @update:show="
        (v) => {
          if (!v) selectedTemplate = null
        }
      "
    >
      <NForm :model="form" label-placement="left" label-width="100">
        <NFormItem label="主角姓名">
          <NInput v-model:value="form.protagonistName" placeholder="例如：林婉儿" />
        </NFormItem>
        <NFormItem label="主角身份">
          <NInput v-model:value="form.protagonistIdentity" placeholder="例如：隐藏身份的豪门千金" />
        </NFormItem>
        <NFormItem label="核心矛盾">
          <NInput v-model:value="form.coreConflict" placeholder="例如：家族恩怨与真爱抉择" />
        </NFormItem>
        <NFormItem label="目标受众">
          <NSelect v-model:value="form.targetAudience" :options="audienceOptions" />
        </NFormItem>
        <NFormItem label="目标集数">
          <NInputNumber v-model:value="form.targetEpisodes" :min="10" :max="100" />
        </NFormItem>
        <NFormItem label="关联项目">
          <NSelect
            v-model:value="form.projectId"
            :options="projectOptions"
            placeholder="不选则自动创建新项目"
            clearable
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="form-actions">
          <NButton :disabled="generating" @click="selectedTemplate = null">取消</NButton>
          <NButton type="primary" :loading="generating" @click="generateOutline">
            生成大纲
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NInputNumber,
  NButton,
  NTag,
  NProgress,
  NModal,
  useMessage
} from 'naive-ui'
import { api } from '../api'
import { useProjectStore } from '../stores/project'

const message = useMessage()
const router = useRouter()
const projectStore = useProjectStore()

const builtinTemplates = ref<any[]>([])
const selectedTemplate = ref<any>(null)
const showFormModal = ref(false)
const generating = ref(false)
const generateProgress = ref(0)
const generateStatus = ref('')
const projects = ref<any[]>([])

const form = ref({
  protagonistName: '',
  protagonistIdentity: '',
  coreConflict: '',
  targetAudience: '下沉市场',
  targetEpisodes: 40,
  projectId: ''
})

const audienceOptions = [
  { label: '下沉市场', value: '下沉市场' },
  { label: '都市白领', value: '都市白领' },
  { label: 'Z世代', value: 'Z世代' },
  { label: '中年群体', value: '中年群体' }
]

const projectOptions = computed(() => projects.value.map((p) => ({ label: p.name, value: p.id })))

async function loadTemplates() {
  try {
    const res = await api.get('/templates')
    builtinTemplates.value = res.data.builtin
  } catch {
    message.error('加载模板失败')
  }
}

async function loadProjects() {
  try {
    const res = await api.get('/projects')
    projects.value = res.data
  } catch {
    // ignore
  }
}

function selectTemplate(template: any) {
  selectedTemplate.value = template
  showFormModal.value = true
}

async function generateOutline() {
  if (!selectedTemplate.value) return

  generating.value = true
  generateProgress.value = 10
  generateStatus.value = '正在分析模板结构...'

  const progressTimer = setInterval(() => {
    if (generateProgress.value < 90) {
      generateProgress.value += Math.floor(Math.random() * 15) + 5
      if (generateProgress.value > 90) generateProgress.value = 90

      const statuses = [
        '正在构思剧情主线...',
        '正在设计角色冲突...',
        '正在安排付费卡点...',
        '正在生成悬念钩子...',
        '正在优化剧情节奏...',
        '正在校验集数结构...'
      ]
      const idx = Math.floor((generateProgress.value / 90) * statuses.length)
      generateStatus.value = statuses[Math.min(idx, statuses.length - 1)]
    }
  }, 3000)

  try {
    let projectId = form.value.projectId

    // Auto-create project if none selected
    if (!projectId) {
      const name = `${selectedTemplate.value.name} - ${form.value.protagonistName || '主角'}`
      const project = await projectStore.createProject({
        name,
        description: `基于模板「${selectedTemplate.value.name}」自动生成`
      })
      projectId = project.id
      projects.value.unshift(project)
    }

    await api.post(`/templates/${selectedTemplate.value.id}/generate-outline`, {
      projectId,
      protagonistName: form.value.protagonistName || '主角',
      protagonistIdentity: form.value.protagonistIdentity || '普通人',
      coreConflict: form.value.coreConflict || '身份冲突',
      targetAudience: form.value.targetAudience,
      targetEpisodes: form.value.targetEpisodes
    })
    generateProgress.value = 100
    generateStatus.value = '生成完成！'
    message.success('大纲生成成功！')
    router.push(`/project/${projectId}/outline`)
  } catch (e: any) {
    message.error(e?.response?.data?.error || '生成失败，请重试')
  } finally {
    clearInterval(progressTimer)
    generating.value = false
    generateProgress.value = 0
    generateStatus.value = ''
    showFormModal.value = false
    selectedTemplate.value = null
  }
}

onMounted(() => {
  loadTemplates()
  loadProjects()
})
</script>

<style scoped>
.templates-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 28px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.template-card {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.template-card.selected {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%);
}

.template-badge {
  display: inline-block;
  padding: 2px 10px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 10px;
}

.template-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
}

.template-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 14px;
  line-height: 1.5;
}

.template-structure {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.act-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--color-bg-gray);
  border-radius: var(--radius-md);
  font-size: 12px;
}

.act-label {
  font-weight: 500;
}

.act-range {
  color: var(--color-text-secondary);
}

.template-paywall {
  margin-top: 8px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.generate-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.generate-modal {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: 40px 48px;
  width: 400px;
  text-align: center;
  box-shadow: var(--shadow-xl);
}

.generate-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.generate-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}

.generate-status {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
  min-height: 20px;
}

.generate-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 16px;
}
</style>
