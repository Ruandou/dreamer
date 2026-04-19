<script setup lang="ts">
import { NBreadcrumb, NBreadcrumbItem, NSpace, NIcon } from 'naive-ui'
import { HomeOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: any
}

interface Props {
  items: BreadcrumbItem[]
  /** Whether to show home icon at the start */
  showHome?: boolean
}

withDefaults(defineProps<Props>(), {
  showHome: true
})

const router = useRouter()

const handleNavigate = (href?: string) => {
  if (href) {
    router.push(href)
  }
}
</script>

<template>
  <div class="breadcrumb-wrapper">
    <NBreadcrumb separator=">" separator-color="var(--color-text-tertiary)">
      <!-- Home Icon -->
      <NBreadcrumbItem v-if="showHome" @click="handleNavigate('/projects')">
        <NSpace :size="4" align="center">
          <NIcon :component="HomeOutline" :size="16" />
          <span>首页</span>
        </NSpace>
      </NBreadcrumbItem>

      <!-- Breadcrumb Items -->
      <NBreadcrumbItem
        v-for="(item, index) in items"
        :key="index"
        :class="{ 'breadcrumb-item--active': index === items.length - 1 }"
        @click="handleNavigate(item.href)"
      >
        <NSpace v-if="item.icon" :size="4" align="center">
          <NIcon :component="item.icon" :size="14" />
          <span>{{ item.label }}</span>
        </NSpace>
        <span v-else>{{ item.label }}</span>
      </NBreadcrumbItem>
    </NBreadcrumb>
  </div>
</template>

<style scoped>
.breadcrumb-wrapper {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) 0;
}

:deep(.n-breadcrumb-item) {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition: color var(--transition-fast);
}

:deep(.n-breadcrumb-item:hover) {
  color: var(--color-primary);
  cursor: pointer;
}

:deep(.n-breadcrumb-item__separator) {
  color: var(--color-text-tertiary);
  margin: 0 var(--spacing-xs);
}

.breadcrumb-item--active {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.breadcrumb-item--active:hover {
  color: var(--color-text-primary);
  cursor: default;
}
</style>
