import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/projects'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('@/views/Import.vue'),
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('@/views/Stats.vue'),
  },
  {
    path: '/jobs',
    name: 'Jobs',
    component: () => import('@/views/Jobs.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('@/views/Projects.vue'),
  },
  {
    path: '/project/:id',
    name: 'ProjectDetail',
    component: () => import('@/views/ProjectDetail.vue'),
    children: [
      {
        path: '',
        name: 'ProjectHome',
        redirect: (to) => ({ name: 'ProjectScript', params: { id: to.params.id } })
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
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
