<script setup lang="ts">
import { NModal, NForm, NFormItem, NInput, NAlert, NButton, NSpace } from 'naive-ui'

interface Props {
  show: boolean
  summary: string
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:summary': [value: string]
  confirm: []
}>()
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="AI 扩写剧本"
    style="width: 600px"
    @update:show="emit('update:show', $event)"
  >
    <NAlert type="info" class="modal-alert">
      <template #icon>💡</template>
      输入故事梗概，AI 将为你扩展为结构化的短剧剧本。越详细的梗概，生成效果越好。
    </NAlert>
    <NForm>
      <NFormItem label="故事梗概">
        <NInput
          :value="summary"
          type="textarea"
          placeholder="描述故事背景、主要情节、人物关系等..."
          :rows="6"
          @update:value="emit('update:summary', $event)"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="loading" @click="emit('confirm')"> 开始生成 </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.modal-alert {
  margin-bottom: var(--spacing-lg);
}
</style>
