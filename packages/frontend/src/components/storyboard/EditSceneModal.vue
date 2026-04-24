<script setup lang="ts">
import { NModal, NForm, NFormItem, NInput, NInputNumber, NButton, NSpace } from 'naive-ui'
import type { SceneWithTakes } from '@/stores/scene'

defineProps<{
  show: boolean
  scene: (SceneWithTakes & { editPrompt: string }) | null
  isGenerating: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: []
  'optimize-prompt': []
  'update:scene': [scene: SceneWithTakes & { editPrompt: string }]
}>()
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="编辑分镜"
    style="width: 600px"
    @update:show="(v) => emit('update:show', v)"
  >
    <NForm v-if="scene" :model="scene" label-placement="top">
      <NFormItem label="场景编号" path="sceneNum">
        <NInputNumber v-model:value="scene.sceneNum" :min="1" style="width: 100%" />
      </NFormItem>
      <NFormItem label="场景描述" path="description">
        <NInput
          v-model:value="scene.description"
          type="textarea"
          placeholder="描述这个场景的内容"
          :rows="2"
        />
      </NFormItem>
      <NFormItem label="视频提示词" path="editPrompt">
        <NInput
          v-model:value="scene.editPrompt"
          type="textarea"
          placeholder="用于生成视频的提示词"
          :rows="4"
        />
      </NFormItem>
      <NFormItem>
        <NButton :loading="isGenerating" @click="emit('optimize-prompt')"> AI 优化提示词 </NButton>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" @click="emit('save')">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
