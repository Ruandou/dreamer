<template>
  <div v-if="isReviewing" class="diff-review-bar">
    <div class="diff-review-stats">
      <span class="diff-stat diff-stat--pending">
        <NIcon :component="EyeOutline" :size="14" />
        {{ pendingCount }} 处待审核
      </span>
      <span v-if="additions > 0" class="diff-stat diff-stat--added"> +{{ additions }} 新增 </span>
      <span v-if="deletions > 0" class="diff-stat diff-stat--removed"> -{{ deletions }} 删除 </span>
    </div>
    <div class="diff-review-actions">
      <NButton size="small" type="success" secondary @click="handleAcceptAll">
        <template #icon>
          <NIcon :component="CheckmarkOutline" :size="14" />
        </template>
        全部接受
      </NButton>
      <NButton size="small" type="error" secondary @click="handleRejectAll">
        <template #icon>
          <NIcon :component="CloseOutline" :size="14" />
        </template>
        全部拒绝
      </NButton>
      <NButton size="small" quaternary @click="handleCancel"> 取消 </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { CheckmarkOutline, CloseOutline, EyeOutline } from '@vicons/ionicons5'
import type { DiffReviewState } from '@/lib/diff-review/diff-review-plugin'
import { getDiffCounts } from '@/lib/diff-review/diff-review-plugin'

const props = defineProps<{
  diffState?: DiffReviewState
}>()

const emit = defineEmits<{
  'accept-all': []
  'reject-all': []
  cancel: []
}>()

const isReviewing = computed(() => props.diffState?.isReviewing ?? false)

const counts = computed(() => {
  if (!props.diffState?.isReviewing) {
    return { pending: 0, additions: 0, deletions: 0 }
  }
  return getDiffCounts(props.diffState)
})

const pendingCount = computed(() => counts.value.pending)
const additions = computed(() => counts.value.additions)
const deletions = computed(() => counts.value.deletions)

function handleAcceptAll() {
  emit('accept-all')
}

function handleRejectAll() {
  emit('reject-all')
}

function handleCancel() {
  emit('cancel')
}
</script>

<style scoped>
.diff-review-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin: 8px 16px 0;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.diff-review-stats {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 13px;
}

.diff-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.diff-stat--pending {
  color: var(--color-text-secondary);
}

.diff-stat--added {
  color: var(--color-success, #16a34a);
}

.diff-stat--removed {
  color: var(--color-error, #dc2626);
}

.diff-review-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
