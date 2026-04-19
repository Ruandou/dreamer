<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NLayout, NLayoutSider, NMenu, NButton, NAlert, NProgress, useMessage } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import StatusBadge from '@/components/StatusBadge.vue'
import { pollPipelineJob, type PipelineJob } from '@/api'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const message = useMessage()

const projectId = computed(() => route.params.id as string)
const isCollapsed = ref(false)

const parseJobId = computed(() => (route.query.parseJobId as string) || '')
const parseJobStatus = ref<PipelineJob | null>(null)
const parsePolling = ref(false)

async function pollParseJob(jobId: string) {
  parsePolling.value = true
  parseJobStatus.value = null
  try {
    await pollPipelineJob(
      jobId,
      (j) => {
        parseJobStatus.value = j
      },
      600000,
      2000
    )
    await projectStore.getProject(projectId.value)
    message.success('剧本解析完成')
    router.replace({ path: route.path })
  } catch (e: any) {
    message.error(e?.message || '解析任务失败')
  } finally {
    parsePolling.value = false
    parseJobStatus.value = null
  }
}

onMounted(async () => {
  if (projectId.value) {
    await projectStore.getProject(projectId.value)
  }
  if (parseJobId.value) {
    void pollParseJob(parseJobId.value)
  }
})

const menuOptions: MenuOption[] = [
  {
    label: '基础信息',
    key: 'overview',
    icon: () => '📋',
    onClick: () => router.push(`/project/${projectId.value}/overview`)
  },
  {
    label: '角色库',
    key: 'characters',
    icon: () => '👥',
    onClick: () => router.push(`/project/${projectId.value}/characters`)
  },
  {
    label: '场地库',
    key: 'locations',
    icon: () => '🏙️',
    onClick: () => router.push(`/project/${projectId.value}/locations`)
  },
  {
    label: '分集管理',
    key: 'episodes',
    icon: () => '📑',
    onClick: () => router.push(`/project/${projectId.value}/episodes`)
  },
  {
    label: '成片预览',
    key: 'compose',
    icon: () => '🎞️',
    onClick: () => router.push(`/project/${projectId.value}/compose`)
  }
]

const currentMenu = computed(() => {
  const path = route.path
  if (path.includes('/overview')) return 'overview'
  if (path.includes('/characters')) return 'characters'
  if (path.includes('/locations')) return 'locations'
  if (path.includes('/episodes')) return 'episodes'
  if (path.includes('/compose')) return 'compose'
  if (path.includes('/pipeline')) return 'pipeline'
  if (path.includes('/storyboard')) return 'storyboard'
  /** 旧子路由仍可达：侧栏高亮归到最接近的主 Tab */
  if (path.includes('/script')) return 'overview'
  return 'overview'
})
</script>

<template>
  <NLayout has-sider class="project-layout">
    <!-- Sidebar -->
    <NLayoutSider
      bordered
      :width="260"
      :collapsed-width="72"
      :collapsed="isCollapsed"
      :native-scrollbar="false"
      class="project-sider"
    >
      <!-- Project Header -->
      <div class="project-header">
        <div class="project-header__top">
          <NButton text @click="router.push('/projects')" class="back-btn">
            <span class="back-icon">←</span>
            <span v-if="!isCollapsed">返回</span>
          </NButton>
          <NButton
            text
            circle
            size="small"
            @click="isCollapsed = !isCollapsed"
            class="collapse-btn"
          >
            {{ isCollapsed ? '→' : '←' }}
          </NButton>
        </div>

        <div v-if="!isCollapsed" class="project-header__info">
          <div class="project-cover">🎬</div>
          <h3 class="project-name">{{ projectStore.currentProject?.name || '项目' }}</h3>
          <p class="project-desc">
            {{ projectStore.currentProject?.description || '暂无描述' }}
          </p>
          <StatusBadge status="draft" />
        </div>
      </div>

      <!-- Navigation Menu -->
      <div class="project-nav">
        <div v-if="!isCollapsed" class="project-nav__label">导航</div>
        <NMenu
          v-model:value="currentMenu"
          :options="menuOptions"
          :collapsed="isCollapsed"
          :collapsed-width="72"
          :collapsed-icon-size="20"
        />
      </div>
    </NLayoutSider>

    <!-- Main Content -->
    <div class="project-main">
      <div class="project-main-column">
        <div v-if="parsePolling || parseJobStatus" class="parse-banner">
          <NAlert type="info" :show-icon="false">
            <template #header>正在解析剧本</template>
            {{ parseJobStatus?.progressMeta?.message || '提取角色和场景，请稍候…' }}
            <NProgress
              v-if="parseJobStatus"
              type="line"
              :percentage="Math.min(100, parseJobStatus.progress || 0)"
              class="parse-banner__progress"
            />
          </NAlert>
        </div>

        <div class="project-content">
          <RouterView />
        </div>
      </div>
    </div>
  </NLayout>
</template>

<style scoped>
.parse-banner {
  margin: 0;
  padding: 0;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}

.parse-banner :deep(.n-alert) {
  margin: 0;
  width: 100%;
  max-width: none;
  border-radius: 0;
  box-sizing: border-box;
}

.parse-banner__progress {
  padding-top: 8px;
  margin: 0;
}

.project-layout {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.project-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.project-main :deep(.n-layout-scroll-container) {
  height: 100% !important;
  max-height: 100% !important;
}

.project-main-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.project-sider {
  background: var(--color-bg-white) !important;
}

/* Clean Menu Styles */
:deep(.n-menu-item) {
  margin: 2px 12px;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

:deep(.n-menu-item:hover) {
  background: var(--color-bg-gray);
}

:deep(.n-menu-item--active) {
  background: var(--color-primary-light);
  color: var(--color-primary) !important;
  font-weight: var(--font-weight-medium);
}

:deep(.n-menu-item--active:hover) {
  background: var(--color-primary-light);
}

.project-header {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}

.project-header__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.back-btn {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.back-btn:hover {
  color: var(--color-primary);
}

.back-icon {
  font-size: var(--font-size-base);
}

.collapse-btn {
  color: var(--color-text-tertiary);
}

.project-header__info {
  text-align: center;
}

.project-cover {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--spacing-md);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.project-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-nav {
  padding: var(--spacing-md);
}

.project-nav__label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-sm);
  padding-left: var(--spacing-md);
}

.project-content {
  padding: var(--spacing-lg);
  flex: 1;
  min-height: 0;
  max-height: 100%;
}
/* 其他子页面保持外层滚动 */
.project-content:not(:has(.episode-detail)) {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>

<!-- episode-detail 占满 project-content，仅内部区域滚动 -->
<style>
.project-content {
  padding: var(--spacing-lg);
  flex: 1;
  min-height: 0;
  max-height: 100%;
}
.project-content > .episode-detail {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.project-content .episode-detail__shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.project-content .episode-detail__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.project-content .episode-detail__editor-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
