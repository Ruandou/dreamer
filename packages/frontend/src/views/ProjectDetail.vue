<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NMenu,
  NButton,
  NAvatar,
  NSpace,
  NDropdown,
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
    label: 'AI编剧',
    key: 'script',
    icon: '📝',
    onClick: () => router.push(`/project/${projectId.value}/script`)
  },
  {
    label: '角色库',
    key: 'characters',
    icon: '👥',
    onClick: () => router.push(`/project/${projectId.value}/characters`)
  },
  {
    label: '分镜控制台',
    key: 'storyboard',
    icon: '🎬',
    onClick: () => router.push(`/project/${projectId.value}/storyboard`)
  },
  {
    label: '视频合成',
    key: 'compose',
    icon: '🎞️',
    onClick: () => router.push(`/project/${projectId.value}/compose`)
  },
  {
    label: 'AI流水线',
    key: 'pipeline',
    icon: '⚡',
    onClick: () => router.push(`/project/${projectId.value}/pipeline`)
  }
]

const currentMenu = computed(() => {
  const path = route.path
  if (path.includes('/script')) return 'script'
  if (path.includes('/characters')) return 'characters'
  if (path.includes('/storyboard')) return 'storyboard'
  if (path.includes('/compose')) return 'compose'
  if (path.includes('/pipeline')) return 'pipeline'
  return 'script'
})

const currentTabIndex = computed(() => {
  const tabs = ['script', 'characters', 'storyboard', 'compose', 'pipeline']
  return tabs.indexOf(currentMenu.value)
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

    <!-- Main Content -->
    <NLayout content-style="padding: 0; background: var(--color-bg-base);">
      <div v-if="parsePolling || parseJobStatus" class="parse-banner">
        <NAlert type="info" :show-icon="false">
          <template #header>正在解析剧本</template>
          {{ parseJobStatus?.progressMeta?.message || '提取角色和场景，请稍候…' }}
          <NProgress
            v-if="parseJobStatus"
            type="line"
            :percentage="Math.min(100, parseJobStatus.progress || 0)"
            style="margin-top: 8px"
          />
        </NAlert>
      </div>
      <!-- Top Bar -->
      <header class="project-topbar">
        <div class="project-topbar__left">
          <h2 class="project-topbar__title">
            {{ menuOptions.find(m => m.key === currentMenu)?.label }}
          </h2>
          <NTag v-if="projectStore.currentProject" size="small" round>
            {{ projectStore.currentProject.name }}
          </NTag>
        </div>
        <div class="project-topbar__right">
          <NSpace>
            <NButton size="small" quaternary>
              帮助
            </NButton>
          </NSpace>
        </div>
      </header>

      <!-- Page Content -->
      <div class="project-content">
        <RouterView />
      </div>
    </NLayout>
  </NLayout>
</template>

<style scoped>
.parse-banner {
  padding: var(--spacing-md) var(--spacing-lg) 0;
}

.project-layout {
  height: 100vh;
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
  min-height: calc(100vh - 60px);
}
</style>
