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
  PeopleOutline,
  LocationOutline,
  ListOutline,
  LibraryOutline,
  ImagesOutline
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
        meta: { title: '项目', icon: FolderOpenOutline }
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
            redirect: (to) => ({ name: 'ProjectOutline', params: { id: to.params.id } })
          },
          {
            path: 'outline',
            name: 'ProjectOutline',
            component: () => import('@/views/project/ProjectOutline.vue'),
            meta: { title: '大纲', icon: ListOutline, projectLayout: true }
          },
          {
            path: 'write',
            name: 'ProjectWrite',
            component: () => import('@/views/project/ProjectWrite.vue'),
            meta: { title: '写作', icon: CreateOutline, projectLayout: true }
          },
          {
            path: 'write/:episodeId',
            name: 'ProjectWriteEpisode',
            component: () => import('@/views/project/ProjectWrite.vue'),
            meta: { title: '写作', icon: CreateOutline, projectLayout: true }
          },
          {
            path: 'characters',
            name: 'ProjectCharacters',
            component: () => import('@/views/project/ProjectCharacters.vue'),
            meta: { title: '角色', icon: PeopleOutline, projectLayout: true }
          },
          {
            path: 'characters/:characterId',
            name: 'ProjectCharacterDetail',
            component: () => import('@/views/project/ProjectCharacterDetail.vue'),
            meta: { title: '角色详情', icon: PeopleOutline, projectLayout: true }
          },
          {
            path: 'locations',
            name: 'ProjectLocations',
            component: () => import('@/views/project/ProjectLocations.vue'),
            meta: { title: '场地', icon: LocationOutline, projectLayout: true }
          },
          {
            path: 'export',
            name: 'ProjectExport',
            component: () => import('@/views/project/ProjectExport.vue'),
            meta: { title: '导出', icon: DocumentTextOutline, projectLayout: true }
          }
        ]
      },
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('@/views/Templates.vue'),
        meta: { title: '模板库', icon: LibraryOutline }
      },
      {
        path: 'assets',
        name: 'Assets',
        component: () => import('@/views/Assets.vue'),
        meta: { title: '素材库', icon: ImagesOutline }
      },
      {
        path: 'import',
        name: 'Import',
        component: () => import('@/views/Import.vue'),
        meta: { title: '导入', icon: DownloadOutline }
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('@/views/Stats.vue'),
        meta: { title: '数据', icon: BarChartOutline }
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
        meta: { title: '任务', icon: TimeOutline }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '设置', icon: SettingsOutline }
      },
      // 旧路由兼容重定向
      {
        path: 'scripts',
        redirect: '/projects'
      },
      {
        path: 'studio',
        redirect: '/projects'
      },
      {
        path: 'studio/:id',
        redirect: '/projects'
      },
      {
        path: 'editor',
        redirect: '/projects'
      },
      {
        path: 'editor/:id',
        redirect: '/projects'
      },
      {
        path: 'generate',
        redirect: '/projects'
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
