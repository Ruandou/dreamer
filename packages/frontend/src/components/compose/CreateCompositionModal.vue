<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NSpace, NModal, NForm, NFormItem, NInput } from 'naive-ui'

const show = defineModel<boolean>('show', { required: true })

const emit = defineEmits<{
  create: [title: string]
}>()

const newComposition = ref({ title: '' })

const handleCreate = () => {
  if (!newComposition.value.title.trim()) {
    return
  }
  emit('create', newComposition.value.title)
  newComposition.value = { title: '' }
  show.value = false
}
</script>

<template>
  <NModal v-model:show="show" preset="card" title="新建合成" style="width: 400px">
    <NForm :model="newComposition" label-placement="top">
      <NFormItem label="作品标题" path="title">
        <NInput v-model:value="newComposition.title" placeholder="给合成作品起个名字" />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="show = false">取消</NButton>
        <NButton type="primary" @click="handleCreate">创建</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
