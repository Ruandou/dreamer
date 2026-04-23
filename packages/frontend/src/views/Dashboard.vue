<template>
  <div class="page-shell dashboard-page">
    <!-- 欢迎问候 -->
    <div class="dashboard-header">
      <h1 class="greeting">{{ greeting }}，{{ uiStore.userName || '用户' }} 👋</h1>
      <p class="sub-title">今天想做点什么？</p>
    </div>

    <!-- 快捷操作 -->
    <div class="dashboard-quick-actions">
      <NCard hoverable class="action-card action-card--primary" @click="navigateTo('/projects')">
        <div class="action-icon">
          <NIcon :component="AddCircleOutline" :size="32" />
        </div>
        <h3>新建项目</h3>
        <p>从零创建短剧项目</p>
      </NCard>
      <NCard hoverable class="action-card action-card--secondary" @click="navigateTo('/studio')">
        <div class="action-icon">
          <NIcon :component="CreateOutline" :size="32" />
        </div>
        <h3>AI 写作工作室</h3>
        <p>AI 辅助剧本创作</p>
      </NCard>
      <NCard hoverable class="action-card action-card--tertiary" @click="navigateTo('/import')">
        <div class="action-icon">
          <NIcon :component="DownloadOutline" :size="32" />
        </div>
        <h3>导入剧本</h3>
        <p>上传并解析现有剧本</p>
      </NCard>
    </div>

    <!-- 统计卡片 -->
    <div class="dashboard-stats-row">
      <NStatistic class="stat-card">
        <template #label>本月项目</template>
        <template #default>{{ stats.projectCount }}</template>
      </NStatistic>
      <NStatistic class="stat-card">
        <template #label>完成任务</template>
        <template #default>{{ stats.completedTasks }}</template>
      </NStatistic>
      <NStatistic class="stat-card">
        <template #label>AI 成本 (¥)</template>
        <template #default>{{ stats.aiCost }}</template>
      </NStatistic>
      <NStatistic class="stat-card">
        <template #label>进行中任务</template>
        <template #default>{{ stats.processingTasks }}</template>
      </NStatistic>
    </div>

    <!-- 双列内容区 -->
    <div class="dashboard-grid">
      <!-- 最近项目 -->
      <NCard title="最近项目" :bordered="false" class="content-card">
        <template #header-extra>
          <NButton text @click="navigateTo('/projects')">查看全部</NButton>
        </template>
        <div v-if="recentProjects.length === 0" class="empty-hint">暂无项目</div>
        <div v-else class="project-list">
          <div
            v-for="project in recentProjects"
            :key="project.id"
            class="project-item"
            @click="navigateTo(`/project/${project.id}`)"
          >
            <div class="project-info">
              <h4>{{ project.name }}</h4>
              <p v-if="project.description">{{ project.description }}</p>
              <span class="project-date">{{ formatDate(project.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </NCard>

      <!-- 最近任务 -->
      <NCard title="最近任务" :bordered="false" class="content-card">
        <template #header-extra>
          <NButton text @click="navigateTo('/jobs')">查看全部</NButton>
        </template>
        <div v-if="recentTasks.length === 0" class="empty-hint">暂无任务</div>
        <div v-else class="task-list">
          <div v-for="task in recentTasks" :key="task.id" class="task-item">
            <NTag
              :type="
                task.status === 'completed'
                  ? 'success'
                  : task.status === 'failed'
                    ? 'error'
                    : 'info'
              "
              size="small"
            >
              {{ task.status }}
            </NTag>
            <span class="task-type">{{ getTaskTypeLabel(task.type) }}</span>
            <span class="task-date">{{ formatDate(task.createdAt) }}</span>
          </div>
        </div>
      </NCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NStatistic, NButton, NTag, NIcon } from 'naive-ui'
import { AddCircleOutline, CreateOutline, DownloadOutline } from '@vicons/ionicons5'
import { useUIStore } from '../stores/ui'
import { api } from '../api'

const router = useRouter()
const uiStore = useUIStore()

// 数据
const projects = ref<any[]>([])
const tasks = ref<any[]>([])
const stats = ref({
  projectCount: 0,
  completedTasks: 0,
  aiCost: 0,
  processingTasks: 0
})

// 计算属性
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const recentProjects = computed(() => projects.value.slice(0, 5))
const recentTasks = computed(() => tasks.value.slice(0, 5))

// 方法
function navigateTo(path: string) {
  router.push(path)
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

function getTaskTypeLabel(type: string) {
  const map: Record<string, string> = {
    video: '视频',
    import: '导入',
    pipeline: '流水线',
    image: '图片'
  }
  return map[type] || type
}

// 加载数据
onMounted(async () => {
  try {
    const [projectsRes, statsRes, tasksRes] = await Promise.all([
      api.get('/projects'),
      api.get('/stats/me'),
      api.get('/tasks/all?limit=5')
    ])

    projects.value = projectsRes.data || []
    stats.value.projectCount = projectsRes.data?.length || 0
    stats.value.aiCost = statsRes.data?.totalCost || 0
    tasks.value = tasksRes.data?.jobs || []
  } catch {
    // 静默失败
  }
})
</script>

<style scoped>
.dashboard-page {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 24px;
}

.greeting {
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.sub-title {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin: 0;
}

.dashboard-quick-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.action-card {
  cursor: pointer;
  text-align: center;
  transition: transform 0.2s;
}

.action-card:hover {
  transform: translateY(-2px);
}

.action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
  transition: all var(--transition-normal);
}

.action-card--primary .action-icon {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.action-card--secondary .action-icon {
  background: rgba(139, 92, 246, 0.12);
  color: var(--color-secondary);
}

.action-card--tertiary .action-icon {
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-success);
}

.action-card:hover .action-icon {
  transform: scale(1.08);
}

.action-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--color-text-primary);
}

.action-card p {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.dashboard-stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--color-bg-white);
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.content-card {
  background: var(--color-bg-white);
}

.project-list,
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-item {
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.project-item:hover {
  background: var(--color-bg-secondary);
}

.project-info h4 {
  margin: 0 0 4px;
  font-size: 15px;
  color: var(--color-text-primary);
}

.project-info p {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-date {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.task-item:last-child {
  border-bottom: none;
}

.task-type {
  flex: 1;
  font-size: 14px;
  color: var(--color-text-primary);
}

.task-date {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.empty-hint {
  text-align: center;
  padding: 24px;
  color: var(--color-text-tertiary);
}

@media (max-width: 1024px) {
  .dashboard-quick-actions {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard-stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard-quick-actions {
    grid-template-columns: 1fr;
  }
  .dashboard-stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
