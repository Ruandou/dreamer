<template>
  <NModal v-model:show="showModal" preset="card" title="AI 修改对比" style="width: 900px">
    <div class="diff-container">
      <div class="diff-panel">
        <div class="diff-panel-header">
          <NIcon
            :component="CloseCircleOutline"
            :size="16"
            class="diff-panel-icon diff-panel-icon--old"
          />
          <h4>修改前</h4>
        </div>
        <pre class="diff-text diff-old">{{ originalContent }}</pre>
      </div>
      <div class="diff-panel">
        <div class="diff-panel-header">
          <NIcon
            :component="CheckmarkCircleOutline"
            :size="16"
            class="diff-panel-icon diff-panel-icon--new"
          />
          <h4>修改后</h4>
        </div>
        <pre class="diff-text diff-new">{{ revisedContent }}</pre>
      </div>
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
import { computed } from 'vue'
import { NModal, NButton, NIcon } from 'naive-ui'
import {
  CloseCircleOutline,
  CheckmarkCircleOutline,
  CloseOutline,
  CheckmarkOutline
} from '@vicons/ionicons5'

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
.diff-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  max-height: 60vh;
  overflow: auto;
}

.diff-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.diff-panel-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.diff-panel-icon {
  flex-shrink: 0;
}

.diff-panel-icon--old {
  color: var(--color-error);
}

.diff-panel-icon--new {
  color: var(--color-success);
}

.diff-text {
  padding: 12px;
  background: var(--color-bg-gray);
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.diff-old {
  border-left: 3px solid var(--color-error);
}

.diff-new {
  border-left: 3px solid var(--color-success);
}

.diff-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
