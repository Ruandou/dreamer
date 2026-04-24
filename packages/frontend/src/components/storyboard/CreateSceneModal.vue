<script setup lang="ts">
import { NModal, NForm, NFormItem, NInput, NButton, NSpace } from 'naive-ui'
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  create: [data: { description: string; prompt: string }]
}>()

const form = ref({ description: '', prompt: '' })

watch(
  () => props.show,
  (val) => {
    if (!val) {
      form.value = { description: '', prompt: '' }
    }
  }
)

function handleCreate() {
  emit('create', { ...form.value })
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="添加分镜"
    style="width: 500px"
    @update:show="(v) => emit('update:show', v)"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem label="场景描述" path="description">
        <NInput
          v-model:value="form.description"
          type="textarea"
          placeholder="描述这个场景的内容"
          :rows="3"
        />
      </NFormItem>
      <NFormItem label="视频提示词（可选）" path="prompt">
        <NInput
          v-model:value="form.prompt"
          type="textarea"
          placeholder="用于生成视频的提示词，不填则使用场景描述"
          :rows="3"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" @click="handleCreate">创建</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
