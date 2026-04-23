<template>
  <NButton size="small" type="primary" @click="$emit('apply')">
    <template #icon>
      <NIcon :component="CreateOutline" :size="14" />
    </template>
    应用到编辑器
  </NButton>
</template>

<script setup lang="ts">
import { NButton, NIcon } from 'naive-ui'
import { CreateOutline } from '@vicons/ionicons5'

defineEmits<{
  apply: []
}>()
</script>
