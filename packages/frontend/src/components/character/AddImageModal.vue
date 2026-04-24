<script setup lang="ts">
import { NModal, NForm, NFormItem, NInput, NTag, NButton, NSpace, NUpload } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'

const props = defineProps<{
  show: boolean
  form: {
    name: string
    type: string
    parentId: string | undefined
    description: string
  }
  selectedFileName: string | null
  isUploading: boolean
  addByAiLoading: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:form': [value: typeof props.form]
  fileChange: [options: { file: UploadFileInfo }]
  confirmAdd: []
  confirmAddByAi: []
}>()

function updateForm(partial: Partial<typeof props.form>) {
  emit('update:form', { ...props.form, ...partial })
}

function getTypeLabel(t: string) {
  return t === 'base' ? '基础' : t === 'outfit' ? '服装' : t === 'expression' ? '表情' : '姿态'
}

function getTypeTagType(t: string) {
  return t === 'base'
    ? 'success'
    : t === 'outfit'
      ? 'info'
      : t === 'expression'
        ? 'warning'
        : ('default' as const)
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="emit('update:show', $event)"
    preset="card"
    :title="form.parentId ? '添加衍生形象' : '添加基础形象'"
    style="width: 480px"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem label="形象名称" path="name">
        <NInput
          :value="form.name"
          @update:value="updateForm({ name: $event })"
          placeholder="如：日常装、战斗版、微笑表情"
        />
      </NFormItem>
      <NFormItem label="类型" path="type">
        <NSpace>
          <NTag
            v-for="t in ['base', 'outfit', 'expression', 'pose']"
            :key="t"
            :type="form.type === t ? getTypeTagType(t) : 'default'"
            :bordered="form.type !== t"
            checkable
            @click="updateForm({ type: t })"
          >
            {{ getTypeLabel(t) }}
          </NTag>
        </NSpace>
      </NFormItem>
      <NFormItem v-if="form.parentId" label="说明（可选，AI 建槽用）" path="description">
        <NInput
          :value="form.description"
          @update:value="updateForm({ description: $event })"
          type="textarea"
          :rows="2"
          placeholder="如：夜礼服、战斗伤痕妆"
        />
      </NFormItem>
      <NFormItem label="参考图" path="file">
        <NUpload
          accept="image/*"
          :max="1"
          :disabled="isUploading"
          @change="emit('fileChange', $event)"
        >
          <NButton :loading="isUploading">选择图片</NButton>
        </NUpload>
        <div v-if="selectedFileName" class="selected-file-info">
          <span>已选择: {{ selectedFileName }}</span>
        </div>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton secondary :loading="addByAiLoading" @click="emit('confirmAddByAi')">
          不上传图，AI 建槽位
        </NButton>
        <NButton type="primary" :loading="isUploading" @click="emit('confirmAdd')">
          创建形象
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.selected-file-info {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-success);
}
</style>
