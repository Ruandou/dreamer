import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

/** 仅允许站内相对路径，防止开放重定向 */
function safeInternalRedirect(fullPath: string): string | undefined {
  if (!fullPath.startsWith('/') || fullPath.startsWith('//')) return undefined
  return fullPath
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/projects'
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
  {
    path: '/import',
    name: 'Import',
    component: () => import('@/views/Import.vue')
  },
  {
    path: '/generate',
    name: 'Generate',
    component: () => import('@/views/Generate.vue')
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('@/views/Stats.vue')
  },
  {
    path: '/model-calls',
    name: 'ModelCalls',
    component: () => import('@/views/ModelCalls.vue')
  },
  {
    path: '/jobs',
    name: 'Jobs',
    component: () => import('@/views/Jobs.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue')
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('@/views/Projects.vue')
  },
  {
    path: '/project/:id',
    name: 'ProjectDetail',
    component: () => import('@/views/ProjectDetail.vue'),
    children: [
      {
        path: '',
        name: 'ProjectHome',
        redirect: (to) => ({ name: 'ProjectOverview', params: { id: to.params.id } })
      },
      {
        path: 'overview',
        name: 'ProjectOverview',
        component: () => import('@/views/ProjectOverview.vue')
      },
      {
        path: 'script',
        name: 'ProjectScript',
        component: () => import('@/views/ProjectScript.vue')
      },
      {
        path: 'characters',
        name: 'ProjectCharacters',
        component: () => import('@/views/ProjectCharacters.vue')
      },
      {
        path: 'locations',
        name: 'ProjectLocations',
        component: () => import('@/views/ProjectLocations.vue')
      },
      {
        path: 'episodes',
        name: 'ProjectEpisodes',
        component: () => import('@/views/ProjectEpisodes.vue')
      },
      {
        path: 'episodes/:episodeId',
        name: 'ProjectEpisodeDetail',
        component: () => import('@/views/ProjectEpisodeDetail.vue')
      },
      {
        path: 'characters/:characterId',
        name: 'ProjectCharacterDetail',
        component: () => import('@/views/ProjectCharacterDetail.vue')
      },
      {
        path: 'storyboard',
        name: 'ProjectStoryboard',
        component: () => import('@/views/ProjectStoryboard.vue')
      },
      {
        path: 'compose',
        name: 'ProjectCompose',
        component: () => import('@/views/ProjectCompose.vue')
      },
      {
        path: 'pipeline',
        name: 'ProjectPipeline',
        component: () => import('@/views/ProjectPipeline.vue')
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
    return { path: '/projects' }
  }
  if (!token && !isPublic) {
    const redirect = safeInternalRedirect(to.fullPath) || '/projects'
    return { name: 'Login', query: { redirect } }
  }
})

export default router
