<template>
  <NModal v-model:show="showModal" preset="card" title="AI 修改对比" style="width: 900px">
    <!-- Diff Stats Header -->
    <div v-if="diffLines.length > 0" class="diff-stats">
      <span class="diff-stat diff-stat--added">+{{ stats.additions }} 新增</span>
      <span class="diff-stat diff-stat--removed">-{{ stats.deletions }} 删除</span>
      <span class="diff-stat diff-stat--total">{{ diffLines.length }} 行</span>
    </div>

    <!-- Empty state -->
    <div v-else class="diff-empty">没有检测到修改内容</div>

    <!-- Unified Diff View -->
    <div v-if="diffLines.length > 0" class="diff-file">
      <div
        v-for="(line, index) in displayedLines"
        :key="index"
        class="diff-line"
        :class="'diff-line--' + line.type"
      >
        <span class="diff-line-num diff-line-num--old">{{ line.oldLineNumber || '' }}</span>
        <span class="diff-line-num diff-line-num--new">{{ line.newLineNumber || '' }}</span>
        <span class="diff-line-sign" :class="'diff-line-sign--' + line.type">{{
          line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '
        }}</span>
        <span class="diff-line-content">{{ line.content || ' ' }}</span>
      </div>

      <!-- Expand button for large diffs -->
      <NButton
        v-if="hasMoreLines"
        class="diff-expand-btn"
        text
        size="small"
        @click="showAllLines = true"
      >
        显示全部 {{ diffLines.length }} 行
      </NButton>
    </div>

    <template #footer>
      <div class="diff-actions">
        <NButton secondary @click="handleReject">
          <template #icon>
            <NIcon :component="CloseOutline" :size="16" />
          </template>
          拒绝
        </NButton>
        <NButton type="primary" @click="handleAccept">
          <template #icon>
            <NIcon :component="CheckmarkOutline" :size="16" />
          </template>
          接受修改
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NButton, NIcon } from 'naive-ui'
import { CloseOutline, CheckmarkOutline } from '@vicons/ionicons5'
import { computeDiff, getDiffStats, type DiffLine } from '../../composables/useDiff'

const INITIAL_LINE_LIMIT = 200

const props = defineProps<{
  show: boolean
  originalContent: string
  revisedContent: string
}>()

const emit = defineEmits<{
  (e: 'accept'): void
  (e: 'reject'): void
  (e: 'update:show', value: boolean): void
}>()

const showModal = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const showAllLines = ref(false)

// Reset expanded state when modal opens
watch(
  () => props.show,
  (val) => {
    if (val) showAllLines.value = false
  }
)

const diffLines = computed(() => {
  return computeDiff(props.originalContent, props.revisedContent)
})

const stats = computed(() => {
  return getDiffStats(diffLines.value)
})

const hasMoreLines = computed(() => {
  return diffLines.value.length > INITIAL_LINE_LIMIT && !showAllLines.value
})

const displayedLines = computed<DiffLine[]>(() => {
  if (showAllLines.value) return diffLines.value
  return diffLines.value.slice(0, INITIAL_LINE_LIMIT)
})

function handleAccept() {
  emit('accept')
  showModal.value = false
}

function handleReject() {
  emit('reject')
  showModal.value = false
}
</script>

<style scoped>
/* Diff Stats Bar */
.diff-stats {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--color-bg-light, #f3f4f6);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
}

.diff-stat {
  display: flex;
  align-items: center;
  gap: 2px;
}

.diff-stat--added {
  color: var(--color-success, #16a34a);
}

.diff-stat--removed {
  color: var(--color-error, #dc2626);
}

.diff-stat--total {
  color: var(--color-text-secondary);
  margin-left: auto;
}

.diff-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 14px;
}

/* Diff File */
.diff-file {
  max-height: 50vh;
  overflow: auto;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md);
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 20px;
}

/* Diff Line */
.diff-line {
  display: flex;
  align-items: stretch;
  min-height: 20px;
  border-bottom: 1px solid var(--color-border-light, #f3f4f6);
}

.diff-line:last-child {
  border-bottom: none;
}

.diff-line--added {
  background: var(--color-success-light, #dcfce7);
}

.diff-line--removed {
  background: var(--color-error-light, #fee2e2);
}

/* Line Numbers */
.diff-line-num {
  flex-shrink: 0;
  width: 44px;
  padding: 0 8px;
  text-align: right;
  color: var(--color-text-tertiary, #9ca3af);
  user-select: none;
  background: var(--color-bg-light, #f9fafb);
  border-right: 1px solid var(--color-border-light, #f3f4f6);
}

.diff-line--added .diff-line-num {
  background: var(--color-success-bg, #bbf7d0);
}

.diff-line--removed .diff-line-num {
  background: var(--color-error-bg, #fecaca);
}

/* Sign (+ / - / space) */
.diff-line-sign {
  flex-shrink: 0;
  width: 20px;
  padding: 0 4px;
  text-align: center;
  font-weight: 600;
  user-select: none;
  color: var(--color-text-tertiary);
}

.diff-line-sign--added {
  color: var(--color-success, #16a34a);
}

.diff-line-sign--removed {
  color: var(--color-error, #dc2626);
}

/* Content */
.diff-line-content {
  flex: 1;
  padding: 0 8px;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Expand Button */
.diff-expand-btn {
  display: block;
  width: 100%;
  padding: 8px;
  text-align: center;
}

/* Footer Actions */
.diff-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
