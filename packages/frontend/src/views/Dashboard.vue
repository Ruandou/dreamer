<template>
  <div class="page-shell dashboard-page">
    <!-- 加载态 -->
    <div v-if="isLoading" class="dashboard-loading">
      <SkeletonLoader :rows="3" variant="grid" :show-header="false" />
    </div>

    <!-- 错误态 -->
    <NAlert v-else-if="hasError" type="error" class="dashboard-error">
      加载数据失败
      <NButton text @click="loadData">重试</NButton>
    </NAlert>

    <!-- 正常内容 -->
    <template v-else>
      <!-- Hero 欢迎区 -->
      <div class="dashboard-hero">
        <div class="dashboard-hero__content">
          <div class="dashboard-hero__badge">
            <span class="hero-badge-dot" />
            AI 短剧创作平台
          </div>
          <h1 class="greeting">{{ greeting }}，{{ uiStore.userName || '创作者' }}</h1>
          <p class="sub-title">今天想创作什么样的故事？</p>
        </div>
        <img src="/images/dashboard-hero.png" alt="创作插画" class="dashboard-hero__image" />
      </div>

      <!-- 快捷操作 — 更大更友好的卡片 -->
      <div class="dashboard-quick-actions">
        <div class="action-card action-card--primary" @click="navigateTo('/templates')">
          <div class="action-card__bg" />
          <div class="action-icon">
            <NIcon :component="LibraryOutline" :size="28" />
          </div>
          <div class="action-card__text">
            <h3>从模板开始</h3>
            <p>选择爆款模板，AI生成40集大纲</p>
          </div>
          <div class="action-card__arrow">→</div>
        </div>
        <div class="action-card action-card--secondary" @click="navigateTo('/projects')">
          <div class="action-card__bg" />
          <div class="action-icon">
            <NIcon :component="CreateOutline" :size="28" />
          </div>
          <div class="action-card__text">
            <h3>继续写作</h3>
            <p>回到正在创作的项目</p>
          </div>
          <div class="action-card__arrow">→</div>
        </div>
        <div class="action-card action-card--tertiary" @click="navigateTo('/import')">
          <div class="action-card__bg" />
          <div class="action-icon">
            <NIcon :component="DownloadOutline" :size="28" />
          </div>
          <div class="action-card__text">
            <h3>导入剧本</h3>
            <p>上传并智能解析</p>
          </div>
          <div class="action-card__arrow">→</div>
        </div>
      </div>

      <!-- 统计卡片 — 更柔和的展示 -->
      <div class="dashboard-stats-row">
        <div class="stat-card stat-card--projects">
          <div class="stat-card__icon">
            <NIcon :component="FolderOpenOutline" :size="20" />
          </div>
          <div class="stat-card__body">
            <span class="stat-card__value">{{ stats.projectCount }}</span>
            <span class="stat-card__label">本月项目</span>
          </div>
        </div>
        <div class="stat-card stat-card--tasks">
          <div class="stat-card__icon">
            <NIcon :component="CheckmarkCircleOutline" :size="20" />
          </div>
          <div class="stat-card__body">
            <span class="stat-card__value">{{ stats.completedTasks }}</span>
            <span class="stat-card__label">已完成</span>
          </div>
        </div>
        <div class="stat-card stat-card--cost">
          <div class="stat-card__icon">
            <NIcon :component="WalletOutline" :size="20" />
          </div>
          <div class="stat-card__body">
            <span class="stat-card__value">¥{{ stats.aiCost }}</span>
            <span class="stat-card__label">AI 成本</span>
          </div>
        </div>
        <div class="stat-card stat-card--running">
          <div class="stat-card__icon">
            <NIcon :component="TimeOutline" :size="20" />
          </div>
          <div class="stat-card__body">
            <span class="stat-card__value">{{ stats.processingTasks }}</span>
            <span class="stat-card__label">进行中</span>
          </div>
        </div>
      </div>

      <!-- 双列内容区 -->
      <div class="dashboard-grid">
        <!-- 最近项目 -->
        <NCard title="最近项目" :bordered="false" class="content-card">
          <template #header-extra>
            <NButton text type="primary" @click="navigateTo('/projects')">查看全部 →</NButton>
          </template>
          <div v-if="recentProjects.length === 0" class="empty-hint">
            <img src="/images/empty-state.png" alt="暂无项目" class="empty-hint__img" />
            <p>还没有项目，快去创建一个吧！</p>
          </div>
          <div v-else class="project-list">
            <div
              v-for="project in recentProjects"
              :key="project.id"
              class="project-item"
              @click="navigateTo(`/project/${project.id}`)"
            >
              <div class="project-item__cover" :style="getProjectCoverStyle(project.id)">
                <span class="project-item__emoji">🎬</span>
              </div>
              <div class="project-info">
                <h4>{{ project.name }}</h4>
                <p v-if="project.description">{{ project.description }}</p>
                <div v-if="project.episodes" class="project-progress">
                  <div class="project-progress-track">
                    <div
                      class="project-progress-fill"
                      :style="{ width: getProjectProgress(project) + '%' }"
                    />
                  </div>
                  <span class="project-progress-text"> {{ getProjectProgress(project) }}% </span>
                </div>
                <span class="project-date">{{ formatDate(project.updatedAt) }}</span>
              </div>
            </div>
          </div>
        </NCard>

        <!-- 最近任务 -->
        <NCard title="最近任务" :bordered="false" class="content-card">
          <template #header-extra>
            <NButton text type="primary" @click="navigateTo('/jobs')">查看全部 →</NButton>
          </template>
          <div v-if="recentTasks.length === 0" class="empty-hint">
            <img src="/images/empty-state.png" alt="暂无任务" class="empty-hint__img" />
            <p>任务完成后会出现在这里</p>
          </div>
          <div v-else class="task-list">
            <div v-for="task in recentTasks" :key="task.id" class="task-item">
              <div class="task-item__left">
                <StatusBadge
                  :status="
                    task.status === 'completed'
                      ? 'completed'
                      : task.status === 'failed'
                        ? 'failed'
                        : 'processing'
                  "
                  size="small"
                />
                <span class="task-type">{{ getTaskTypeLabel(task.type) }}</span>
              </div>
              <span class="task-date">{{ formatDate(task.createdAt) }}</span>
            </div>
          </div>
        </NCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NIcon, NAlert } from 'naive-ui'
import {
  LibraryOutline,
  CreateOutline,
  DownloadOutline,
  FolderOpenOutline,
  CheckmarkCircleOutline,
  WalletOutline,
  TimeOutline
} from '@vicons/ionicons5'
import { useUIStore } from '../stores/ui'
import { api } from '../api'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { formatDate } from '../lib/date-formatting'

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

// 加载状态
const isLoading = ref(false)
const hasError = ref(false)

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

function getTaskTypeLabel(type: string) {
  const map: Record<string, string> = {
    video: '视频生成',
    import: '剧本导入',
    pipeline: 'AI 流水线',
    image: '图片生成'
  }
  return map[type] || type
}

const coverGradients = [
  'linear-gradient(135deg, #f4726a 0%, #fb923c 100%)',
  'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
  'linear-gradient(135deg, #34d399 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #fbbf24 0%, #f4726a 100%)',
  'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)'
]

function getProjectCoverStyle(projectId: string) {
  const index = projectId.charCodeAt(0) % coverGradients.length
  return { background: coverGradients[index] }
}

function getProjectProgress(project: any): number {
  if (!project.episodes || project.episodes.length === 0) return 0
  const completed = project.episodes.filter((ep: any) => ep.writeStatus === 'completed').length
  return Math.round((completed / project.episodes.length) * 100)
}

// 加载数据
async function loadData() {
  isLoading.value = true
  hasError.value = false
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
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadData()
})
</script>

<style scoped>
.dashboard-page {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-loading {
  padding: var(--spacing-lg);
}

.dashboard-error {
  margin: var(--spacing-lg);
}

/* Hero Section */
.dashboard-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  padding: 28px 32px;
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fce7f3 100%);
  border-radius: var(--radius-xl);
  border: 1px solid rgba(251, 191, 36, 0.15);
  position: relative;
  overflow: hidden;
}

.dashboard-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  margin-bottom: 14px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(244, 114, 106, 0.15);
}

.hero-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.85);
  }
}

.dashboard-hero__image {
  width: 180px;
  height: auto;
  object-fit: contain;
  flex-shrink: 0;
  margin-left: 16px;
}

.greeting {
  font-size: 28px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.sub-title {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
}

/* Quick Actions */
.dashboard-quick-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

.action-card {
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 24px;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.action-card__bg {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.action-card--primary .action-card__bg {
  background: linear-gradient(135deg, rgba(244, 114, 106, 0.06) 0%, rgba(251, 146, 60, 0.04) 100%);
}

.action-card--secondary .action-card__bg {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.06) 0%, rgba(244, 114, 182, 0.04) 100%);
}

.action-card--tertiary .action-card__bg {
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.06) 0%, rgba(96, 165, 250, 0.04) 100%);
}

.action-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-border);
}

.action-card:hover .action-card__bg {
  opacity: 1;
}

.action-card:hover .action-card__arrow {
  transform: translateX(4px);
}

.action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  flex-shrink: 0;
  transition: all var(--transition-normal);
}

.action-card--primary .action-icon {
  background: linear-gradient(135deg, #ffeaea 0%, #ffedd5 100%);
  color: var(--color-primary);
}

.action-card--secondary .action-icon {
  background: linear-gradient(135deg, #f3e8ff 0%, #fce7f3 100%);
  color: var(--color-secondary);
}

.action-card--tertiary .action-icon {
  background: linear-gradient(135deg, #d1fae5 0%, #dbeafe 100%);
  color: #059669;
}

.action-card:hover .action-icon {
  transform: scale(1.1) rotate(-3deg);
}

.action-card__text {
  flex: 1;
}

.action-card__text h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 4px;
  color: var(--color-text-primary);
}

.action-card__text p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.action-card__arrow {
  font-size: 18px;
  color: var(--color-text-tertiary);
  transition: transform 0.2s ease;
}

/* Stats Row */
.dashboard-stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.stat-card--projects .stat-card__icon {
  background: linear-gradient(135deg, #ffeaea 0%, #ffedd5 100%);
  color: var(--color-primary);
}

.stat-card--tasks .stat-card__icon {
  background: linear-gradient(135deg, #d1fae5 0%, #ccfbf1 100%);
  color: var(--color-success);
}

.stat-card--cost .stat-card__icon {
  background: linear-gradient(135deg, #fef3c7 0%, #ffedd5 100%);
  color: #d97706;
}

.stat-card--running .stat-card__icon {
  background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
  color: var(--color-info);
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-card__value {
  font-size: 20px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1.2;
}

.stat-card__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* Grid & Cards */
.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.content-card {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-sm);
}

/* Project List */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.project-item {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.project-item:hover {
  background: var(--color-bg-gray);
  border-color: var(--color-border-light);
}

.project-item__cover {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.project-item__emoji {
  font-size: 22px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-info h4 {
  margin: 0 0 4px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-info p {
  margin: 0 0 4px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-date {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.project-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.project-progress-track {
  flex: 1;
  height: 4px;
  background: var(--color-bg-gray);
  border-radius: 2px;
  overflow: hidden;
}

.project-progress-fill {
  height: 100%;
  background: var(--color-success);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.project-progress-text {
  font-size: 11px;
  color: var(--color-text-secondary);
  min-width: 32px;
  text-align: right;
}

/* Task List */
.task-list {
  display: flex;
  flex-direction: column;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.task-item:last-child {
  border-bottom: none;
}

.task-item__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-type {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.task-date {
  font-size: 11px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

/* Empty Hint */
.empty-hint {
  text-align: center;
  padding: 32px 24px;
  color: var(--color-text-tertiary);
}

.empty-hint__img {
  width: 120px;
  height: auto;
  margin-bottom: 12px;
  opacity: 0.85;
}

.empty-hint p {
  margin: 0;
  font-size: var(--font-size-sm);
}

@media (max-width: 1024px) {
  .dashboard-hero__image {
    display: none;
  }
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
  .dashboard-hero {
    padding: 20px;
  }
  .greeting {
    font-size: 22px;
  }
  .dashboard-quick-actions {
    grid-template-columns: 1fr;
  }
  .dashboard-stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
