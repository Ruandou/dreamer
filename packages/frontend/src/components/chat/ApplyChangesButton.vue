<template>
  <NButton size="small" type="primary" @click="$emit('apply')">
    <template #icon>
      <span class="apply-icon">✏️</span>
    </template>
    应用到编辑器
  </NButton>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'

defineEmits<{
  apply: []
}>()
</script>

<style scoped>
.apply-icon {
  font-style: normal;
}
</style>
