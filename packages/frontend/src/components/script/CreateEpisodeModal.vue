<script setup lang="ts">
import { NModal, NForm, NFormItem, NInput, NInputNumber, NButton, NSpace } from 'naive-ui'

interface Props {
  show: boolean
  episodeNum: number
  title: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:episodeNum': [value: number]
  'update:title': [value: string]
  confirm: []
}>()
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="新建剧本"
    style="width: 450px"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="top">
      <NFormItem label="集数">
        <NInputNumber
          :value="episodeNum"
          :min="1"
          size="large"
          style="width: 100%"
          @update:value="(v) => emit('update:episodeNum', v ?? 1)"
        />
      </NFormItem>
      <NFormItem label="标题（可选）">
        <NInput
          :value="title"
          placeholder="给这一集起个名字"
          @update:value="emit('update:title', $event)"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" @click="emit('confirm')">创建</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
