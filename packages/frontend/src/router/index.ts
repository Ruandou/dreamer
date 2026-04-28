import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import {
  HomeOutline,
  FolderOpenOutline,
  DocumentTextOutline,
  CreateOutline,
  DownloadOutline,
  TimeOutline,
  BarChartOutline,
  RadioOutline,
  SettingsOutline,
  InformationCircleOutline,
  PeopleOutline,
  LocationOutline,
  ListOutline,
  FilmOutline,
  GitBranchOutline
} from '@vicons/ionicons5'

/** 仅允许站内相对路径，防止开放重定向 */
function safeInternalRedirect(fullPath: string): string | undefined {
  if (!fullPath.startsWith('/') || fullPath.startsWith('//')) return undefined
  return fullPath
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue')
  },
  // 需要侧边栏的路由（DashboardLayout）
  {
    path: '/',
    component: () => import('@/layouts/DashboardLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '工作台', icon: HomeOutline }
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/views/Projects.vue'),
        meta: { title: '项目列表', icon: FolderOpenOutline }
      },
      {
        path: 'scripts',
        name: 'Scripts',
        component: () => import('@/views/Scripts.vue'),
        meta: { title: '剧本列表', icon: DocumentTextOutline }
      },
      {
        path: 'studio',
        name: 'Studio',
        component: () => import('@/views/Studio.vue'),
        meta: { title: 'AI 写作工作室', icon: CreateOutline }
      },
      {
        path: 'studio/:id',
        name: 'StudioDetail',
        component: () => import('@/views/Studio.vue'),
        meta: { title: 'AI 写作工作室', icon: CreateOutline }
      },
      {
        path: 'editor',
        name: 'Editor',
        component: () => import('@/views/EditorPage.vue'),
        meta: { title: 'AI 剧本编辑器', icon: CreateOutline }
      },
      {
        path: 'editor/:id',
        name: 'EditorDetail',
        component: () => import('@/views/EditorPage.vue'),
        meta: { title: 'AI 剧本编辑器', icon: CreateOutline }
      },
      {
        path: 'import',
        name: 'Import',
        component: () => import('@/views/Import.vue'),
        meta: { title: '导入剧本', icon: DownloadOutline }
      },
      {
        path: 'generate',
        name: 'Generate',
        component: () => import('@/views/Generate.vue'),
        meta: { title: '视频生成', icon: FilmOutline }
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('@/views/Stats.vue'),
        meta: { title: '统计分析', icon: BarChartOutline }
      },
      {
        path: 'model-calls',
        name: 'ModelCalls',
        component: () => import('@/views/ModelCalls.vue'),
        meta: { title: '模型日志', icon: RadioOutline }
      },
      {
        path: 'jobs',
        name: 'Jobs',
        component: () => import('@/views/Jobs.vue'),
        meta: { title: '任务中心', icon: TimeOutline }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '设置', icon: SettingsOutline }
      },
      {
        path: 'project/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/ProjectDetail.vue'),
        meta: { projectLayout: true },
        children: [
          {
            path: '',
            name: 'ProjectHome',
            redirect: (to) => ({ name: 'ProjectOverview', params: { id: to.params.id } })
          },
          {
            path: 'overview',
            name: 'ProjectOverview',
            component: () => import('@/views/ProjectOverview.vue'),
            meta: { title: '基础信息', icon: InformationCircleOutline, projectLayout: true }
          },
          {
            path: 'script',
            name: 'ProjectScript',
            component: () => import('@/views/ProjectScript.vue'),
            meta: { title: '剧本编辑', icon: DocumentTextOutline, projectLayout: true }
          },
          {
            path: 'characters',
            name: 'ProjectCharacters',
            component: () => import('@/views/ProjectCharacters.vue'),
            meta: { title: '角色库', icon: PeopleOutline, projectLayout: true }
          },
          {
            path: 'characters/:characterId',
            name: 'ProjectCharacterDetail',
            component: () => import('@/views/ProjectCharacterDetail.vue'),
            meta: { title: '角色详情', icon: PeopleOutline, projectLayout: true }
          },
          {
            path: 'locations',
            name: 'ProjectLocations',
            component: () => import('@/views/ProjectLocations.vue'),
            meta: { title: '场地库', icon: LocationOutline, projectLayout: true }
          },
          {
            path: 'episodes',
            name: 'ProjectEpisodes',
            component: () => import('@/views/ProjectEpisodes.vue'),
            meta: { title: '分集管理', icon: ListOutline, projectLayout: true }
          },
          {
            path: 'episodes/:episodeId',
            name: 'ProjectEpisodeDetail',
            component: () => import('@/views/ProjectEpisodeDetail.vue'),
            meta: { title: '分集详情', icon: ListOutline, projectLayout: true }
          },
          {
            path: 'storyboard',
            name: 'ProjectStoryboard',
            component: () => import('@/views/ProjectStoryboard.vue'),
            meta: { title: '分镜脚本', icon: FilmOutline, projectLayout: true }
          },
          {
            path: 'compose',
            name: 'ProjectCompose',
            component: () => import('@/views/ProjectCompose.vue'),
            meta: { title: '成片预览', icon: FilmOutline, projectLayout: true }
          },
          {
            path: 'pipeline',
            name: 'ProjectPipeline',
            component: () => import('@/views/ProjectPipeline.vue'),
            meta: { title: '流水线', icon: GitBranchOutline, projectLayout: true }
          }
        ]
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const PUBLIC_ROUTE_NAMES = new Set(['Login', 'Register'])

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  const isPublic = to.name != null && PUBLIC_ROUTE_NAMES.has(String(to.name))

  if (token && isPublic) {
    return { path: '/dashboard' }
  }
  if (!token && !isPublic) {
    const redirect = safeInternalRedirect(to.fullPath) || '/dashboard'
    return { name: 'Login', query: { redirect } }
  }
})

export default router
