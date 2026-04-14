<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NMenu,
  NButton,
  NTag,
  NAlert,
  NProgress,
  useMessage
} from 'naive-ui'
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
  /** 旧子路由仍可达：侧栏高亮归到最接近的主 Tab */
  if (path.includes('/script')) return 'overview'
  if (path.includes('/storyboard') || path.includes('/pipeline')) return 'episodes'
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
          <NButton text circle size="small" @click="isCollapsed = !isCollapsed" class="collapse-btn">
            {{ isCollapsed ? '→' : '←' }}
          </NButton>
        </div>

        <div v-if="!isCollapsed" class="project-header__info">
          <div class="project-cover">
            🎬
          </div>
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

    <!-- Main Content：单列 flex，仅内容区滚动，避免与窗口双滚动条 -->
    <NLayout
      class="project-main"
      content-style="padding: 0; background: var(--color-bg-base); display: flex; flex-direction: column; min-height: 0; flex: 1; height: 100%; overflow: hidden;"
    >
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
        <header class="project-topbar">
          <div class="project-topbar__left">
            <h2 class="project-topbar__title">
              {{ menuOptions.find(m => m.key === currentMenu)?.label }}
            </h2>
            <NTag v-if="projectStore.currentProject" size="small" round>
              {{ projectStore.currentProject.name }}
            </NTag>
          </div>
        </header>

        <div class="project-content">
          <RouterView />
        </div>
      </div>
    </NLayout>
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
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.project-main {
  min-height: 0;
}

.project-main-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  height: 100%;
}

.project-sider {
  background: var(--color-bg-white) !important;
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

.project-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.project-topbar__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.project-topbar__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.project-content {
  padding: var(--spacing-lg);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
