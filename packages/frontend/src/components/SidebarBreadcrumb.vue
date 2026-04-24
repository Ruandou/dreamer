<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton, NIcon } from 'naive-ui'
import { ChevronForwardOutline } from '@vicons/ionicons5'

export interface BreadcrumbItem {
  label: string
  path?: string
}

defineProps<{
  crumbs: BreadcrumbItem[]
}>()

const router = useRouter()
</script>

<template>
  <nav class="sidebar-breadcrumb" aria-label="面包屑导航">
    <template v-for="(crumb, index) in crumbs" :key="index">
      <span v-if="index > 0" class="breadcrumb-separator">
        <NIcon :component="ChevronForwardOutline" :size="12" />
      </span>
      <NButton v-if="crumb.path" text class="breadcrumb-link" @click="router.push(crumb.path)">
        {{ crumb.label }}
      </NButton>
      <span v-else class="breadcrumb-link breadcrumb-current">
        {{ crumb.label }}
      </span>
    </template>
  </nav>
</template>

<style scoped>
.sidebar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.breadcrumb-separator {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.breadcrumb-link {
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
  padding: 0;
  font-size: 13px;
}

.breadcrumb-link:hover {
  color: var(--color-primary);
}

.breadcrumb-current {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  cursor: default;
}
</style>
