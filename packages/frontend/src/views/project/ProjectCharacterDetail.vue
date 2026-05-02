<template>
  <div class="character-detail-page">
    <NButton text @click="goBack">
      <template #icon>&larr;</template>
      返回角色库
    </NButton>
    <h2>角色详情</h2>
    <NEmpty description="功能开发中" />
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { NButton, NEmpty } from 'naive-ui'

const router = useRouter()
const route = useRoute()
const projectId = route.params.id as string

function goBack() {
  router.push(`/project/${projectId}/characters`)
}
</script>

<style scoped>
.character-detail-page {
  padding: 20px;
}
</style>
