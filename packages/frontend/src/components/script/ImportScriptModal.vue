<script setup lang="ts">
import { NModal, NForm, NFormItem, NInput, NUpload, NAlert, NButton, NSpace } from 'naive-ui'

interface Props {
  show: boolean
  content: string
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:content': [value: string]
  'file-change': [file: File]
  confirm: []
}>()

function handleFileChange(options: { file: { file: File | null } }) {
  if (options.file.file) {
    emit('file-change', options.file.file)
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="导入剧本文档"
    style="width: 800px"
    @update:show="emit('update:show', $event)"
  >
    <NAlert type="info" class="modal-alert">
      <template #icon>📥</template>
      选择文件或粘贴完整的剧本文档，AI 将自动解析并导入。
    </NAlert>
    <NForm label-placement="top">
      <NFormItem label="选择文件">
        <NUpload
          accept=".md,.markdown,.json,.txt"
          :max-size="10 * 1024 * 1024"
          :show-file-list="false"
          @change="handleFileChange"
        >
          <NButton type="default" dashed>选择文件</NButton>
        </NUpload>
        <p class="file-hint">支持 .md, .json, .txt 格式，单文件不超过 10MB</p>
      </NFormItem>
      <NFormItem label="或粘贴内容">
        <NInput
          :value="content"
          type="textarea"
          placeholder="粘贴完整的剧本文档内容..."
          :rows="12"
          @update:value="emit('update:content', $event)"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="loading" @click="emit('confirm')"> 开始导入 </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.modal-alert {
  margin-bottom: var(--spacing-lg);
}
.file-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-sm);
}
</style>
