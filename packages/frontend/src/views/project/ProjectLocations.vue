<template>
  <div class="locations-page">
    <h2>场地库</h2>
    <p class="subtitle">管理项目中的场地，写作时可拖拽插入</p>
    <NAlert type="info" class="hint">
      提示：在写作页面，可以直接拖拽场地名到编辑器中快速插入。
    </NAlert>
    <div class="coming-soon">
      <NEmpty description="场地管理功能开发中，请使用原项目详情页的场地库">
        <template #extra>
          <NButton @click="goBack">返回项目</NButton>
        </template>
      </NEmpty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { NEmpty, NButton, NAlert } from 'naive-ui'

const router = useRouter()
const route = useRoute()
const projectId = route.params.id as string

function goBack() {
  router.push(`/project/${projectId}/write`)
}
</script>

<style scoped>
.locations-page {
  padding: 20px;
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0 0 12px;
}

.hint {
  margin-bottom: 20px;
}

.coming-soon {
  padding: 60px 20px;
}
</style>
