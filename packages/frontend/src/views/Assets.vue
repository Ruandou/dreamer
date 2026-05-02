<template>
  <div class="assets-page">
    <div class="page-header">
      <h1>素材库</h1>
      <p class="subtitle">管理角色和场地素材</p>
    </div>

    <NTabs type="line" class="assets-tabs">
      <NTabPane name="characters" tab="我的角色">
        <div class="coming-soon">
          <NEmpty description="角色素材管理功能开发中">
            <template #extra>
              <NButton @click="goToProjects">去项目管理</NButton>
            </template>
          </NEmpty>
        </div>
      </NTabPane>
      <NTabPane name="locations" tab="我的场地">
        <div class="coming-soon">
          <NEmpty description="场地素材管理功能开发中">
            <template #extra>
              <NButton @click="goToProjects">去项目管理</NButton>
            </template>
          </NEmpty>
        </div>
      </NTabPane>
    </NTabs>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NTabs, NTabPane, NEmpty, NButton } from 'naive-ui'

const router = useRouter()

function goToProjects() {
  router.push('/projects')
}
</script>

<style scoped>
.assets-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0;
}

.coming-soon {
  padding: 60px 20px;
}
</style>
