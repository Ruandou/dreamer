<template>
  <div class="inline-edit-card">
    <div class="edit-card-header" @click="expanded = !expanded">
      <div class="edit-card-title">
        <NIcon :component="SparklesOutline" :size="14" class="edit-icon" />
        <span>AI 修改建议</span>
        <span class="edit-card-stats">
          <span class="stat-added">+{{ stats.additions }}</span>
          <span class="stat-removed">-{{ stats.deletions }}</span>
        </span>
      </div>
      <NIcon
        :component="expanded ? ChevronUpOutline : ChevronDownOutline"
        :size="14"
        class="expand-icon"
      />
    </div>

    <div v-if="suggestedEdit?.description" class="edit-description">
      {{ suggestedEdit.description }}
    </div>

    <div v-show="expanded" class="edit-diff-preview">
      <div
        v-for="(line, i) in previewLines"
        :key="i"
        class="diff-row"
        :class="'diff-row--' + line.type"
      >
        <span class="diff-sign">{{
          line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '
        }}</span>
        <span class="diff-text">{{ line.content || ' ' }}</span>
      </div>
      <div v-if="hasMore" class="diff-more" @click="showAll = true">
        还有 {{ diffLines.length - PREVIEW_LIMIT }} 行改动，点击查看完整对比
      </div>
    </div>

    <div class="edit-actions">
      <NButton size="small" secondary @click="$emit('reject')">
        <template #icon>
          <NIcon :component="CloseOutline" :size="14" />
        </template>
        拒绝
      </NButton>
      <NButton size="small" type="primary" @click="$emit('accept', suggestedEdit?.content || '')">
        <template #icon>
          <NIcon :component="CheckmarkOutline" :size="14" />
        </template>
        接受修改
      </NButton>
    </div>

    <!-- Full diff modal -->
    <DiffModal
      v-model:show="showAll"
      :original-content="originalContent"
      :revised-content="suggestedEdit?.content || ''"
      @accept="$emit('accept', suggestedEdit?.content || '')"
      @reject="$emit('reject')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import {
  SparklesOutline,
  CloseOutline,
  CheckmarkOutline,
  ChevronDownOutline,
  ChevronUpOutline
} from '@vicons/ionicons5'
import type { ChatMessage } from '@dreamer/shared/types'
import { computeDiff, getDiffStats, type DiffLine } from '../../composables/useDiff'
import DiffModal from './DiffModal.vue'

const PREVIEW_LIMIT = 30

const props = defineProps<{
  message: ChatMessage
  originalContent: string
}>()

defineEmits<{
  accept: [content: string]
  reject: []
}>()

const expanded = ref(true)
const showAll = ref(false)

const suggestedEdit = computed(() => props.message.metadata?.suggestedEdit)

const diffLines = computed<DiffLine[]>(() => {
  if (!suggestedEdit.value) return []
  return computeDiff(props.originalContent, suggestedEdit.value.content)
})

const stats = computed(() => getDiffStats(diffLines.value))

const previewLines = computed<DiffLine[]>(() => {
  if (showAll.value) return diffLines.value
  return diffLines.value.slice(0, PREVIEW_LIMIT)
})

const hasMore = computed(() => diffLines.value.length > PREVIEW_LIMIT && !showAll.value)
</script>

<style scoped>
.inline-edit-card {
  margin-top: 12px;
  background: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  overflow: hidden;
}

.edit-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--color-bg-white, #fff);
  border-bottom: 1px solid var(--color-border-light, #f3f4f6);
  transition: background 0.15s;
}

.edit-card-header:hover {
  background: var(--color-bg-light, #f9fafb);
}

.edit-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
}

.edit-icon {
  color: var(--color-primary, #6366f1);
}

.edit-card-stats {
  display: flex;
  gap: 8px;
  margin-left: 8px;
  font-size: 12px;
  font-weight: 500;
}

.stat-added {
  color: var(--color-success, #16a34a);
}

.stat-removed {
  color: var(--color-error, #dc2626);
}

.expand-icon {
  color: var(--color-text-tertiary, #9ca3af);
  flex-shrink: 0;
}

.edit-description {
  padding: 8px 12px 0;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

.edit-diff-preview {
  padding: 8px 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 18px;
  max-height: 300px;
  overflow: auto;
}

.diff-row {
  display: flex;
  align-items: flex-start;
  min-height: 18px;
  border-radius: 2px;
}

.diff-row--added {
  background: var(--color-success-light, #dcfce7);
}

.diff-row--removed {
  background: var(--color-error-light, #fee2e2);
}

.diff-sign {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
  font-weight: 600;
  user-select: none;
  color: var(--color-text-tertiary, #9ca3af);
}

.diff-row--added .diff-sign {
  color: var(--color-success, #16a34a);
}

.diff-row--removed .diff-sign {
  color: var(--color-error, #dc2626);
}

.diff-text {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
}

.diff-more {
  padding: 6px 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-primary, #6366f1);
  cursor: pointer;
}

.diff-more:hover {
  text-decoration: underline;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-white, #fff);
  border-top: 1px solid var(--color-border-light, #f3f4f6);
}
</style>
