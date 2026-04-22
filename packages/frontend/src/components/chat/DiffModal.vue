<template>
  <NModal v-model:show="showModal" preset="card" title="AI 修改对比" style="width: 900px">
    <div class="diff-container">
      <div class="diff-panel">
        <h4>修改前</h4>
        <pre class="diff-text diff-old">{{ originalContent }}</pre>
      </div>
      <div class="diff-panel">
        <h4>修改后</h4>
        <pre class="diff-text diff-new">{{ revisedContent }}</pre>
      </div>
    </div>
    <template #footer>
      <div class="diff-actions">
        <NButton @click="handleReject">拒绝</NButton>
        <NButton type="primary" @click="handleAccept">接受</NButton>
      </div>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NModal, NButton } from 'naive-ui'

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

.diff-panel h4 {
  margin: 0 0 8px;
  font-size: 14px;
}

.diff-text {
  padding: 12px;
  background: #f9fafb;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow: auto;
}

.diff-old {
  border-left: 3px solid #ef4444;
}

.diff-new {
  border-left: 3px solid #22c55e;
}

.diff-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
