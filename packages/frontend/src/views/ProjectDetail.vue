<script setup lang="ts">
import { computed, onMounted, ref, provide, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NProgress, NIcon, useMessage, type MenuOption } from 'naive-ui'
import {
  InformationCircleOutline,
  PeopleOutline,
  LocationOutline,
  ListOutline,
  FilmOutline,
  GitBranchOutline
} from '@vicons/ionicons5'
import { useProjectStore } from '@/stores/project'
import { pollPipelineJob, type PipelineJob } from '@/api'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const message = useMessage()

const projectId = computed(() => route.params.id as string)

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

function renderIcon(component: any) {
  return () => h(NIcon, { component, size: 20 })
}

// 项目导航菜单 - 通过 provide 传递给 AppSidebar
const projectMenuOptions: MenuOption[] = [
  {
    label: '基础信息',
    key: 'overview',
    icon: renderIcon(InformationCircleOutline),
    onClick: () => router.push(`/project/${projectId.value}/overview`)
  },
  {
    label: '角色库',
    key: 'characters',
    icon: renderIcon(PeopleOutline),
    onClick: () => router.push(`/project/${projectId.value}/characters`)
  },
  {
    label: '场地库',
    key: 'locations',
    icon: renderIcon(LocationOutline),
    onClick: () => router.push(`/project/${projectId.value}/locations`)
  },
  {
    label: '分集管理',
    key: 'episodes',
    icon: renderIcon(ListOutline),
    onClick: () => router.push(`/project/${projectId.value}/episodes`)
  },
  {
    label: '成片预览',
    key: 'compose',
    icon: renderIcon(FilmOutline),
    onClick: () => router.push(`/project/${projectId.value}/compose`)
  },
  {
    label: '流水线',
    key: 'pipeline',
    icon: renderIcon(GitBranchOutline),
    onClick: () => router.push(`/project/${projectId.value}/pipeline`)
  }
]

// 提供菜单选项给父级组件（DashboardLayout 通过 AppSidebar 使用）
provide('projectMenuOptions', projectMenuOptions)
</script>

<template>
  <div class="project-main">
    <!-- 解析进度横幅 -->
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

    <!-- 子路由内容 -->
    <div class="project-content">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.project-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
}

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

.project-content {
  padding: var(--spacing-lg);
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
}
</style>
