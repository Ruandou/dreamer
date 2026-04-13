<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NGrid,
  NGi,
  NButton,
  NSpace,
  NInput,
  NImage,
  NEmpty,
  useMessage
} from 'naive-ui'
import type { ProjectLocation } from '@dreamer/shared/types'
import { api } from '@/api'
import { useProjectStore } from '@/stores/project'
import { subscribeProjectUpdates } from '@/lib/project-sse-bridge'

const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)
const locations = ref<ProjectLocation[]>([])
const loading = ref(false)
const savingId = ref<string | null>(null)
const generatingId = ref<string | null>(null)

let unsubProjectSse: (() => void) | null = null

async function load() {
  loading.value = true
  try {
    const res = await api.get<ProjectLocation[]>(`/locations?projectId=${projectId.value}`)
    locations.value = res.data
  } catch (e: any) {
    message.error(e?.response?.data?.error || '加载场地失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  unsubProjectSse = subscribeProjectUpdates(projectId.value, (p) => {
    if (p.type !== 'image-generation') return
    if (p.status === 'completed' && p.locationId) {
      generatingId.value = null
      void load()
      void projectStore.getProject(projectId.value)
      message.success('定场图已更新')
    }
    if (p.status === 'failed' && p.kind === 'location_establishing') {
      generatingId.value = null
      message.error((p.error as string) || '定场图生成失败')
    }
  })
})

onUnmounted(() => {
  unsubProjectSse?.()
  unsubProjectSse = null
})

async function save(loc: ProjectLocation) {
  savingId.value = loc.id
  try {
    await api.put(`/locations/${loc.id}`, {
      description: loc.description,
      imagePrompt: loc.imagePrompt,
      timeOfDay: loc.timeOfDay
    })
    message.success('已保存')
    await projectStore.getProject(projectId.value)
  } catch (e: any) {
    message.error(e?.response?.data?.error || '保存失败')
  } finally {
    savingId.value = null
  }
}

async function generate(loc: ProjectLocation) {
  generatingId.value = loc.id
  try {
    const res = await api.post<{ jobId: string }>(`/locations/${loc.id}/generate-image`, {})
    message.success(`已入队生成（任务 ${res.data.jobId}）`)
  } catch (e: any) {
    message.error(e?.response?.data?.error || '入队失败')
  } finally {
    generatingId.value = null
  }
}
</script>

<template>
  <div>
    <NCard title="场地库">
      <template #header-extra>
        <NButton quaternary size="small" :loading="loading" @click="load">刷新</NButton>
      </template>
      <NEmpty v-if="!loading && locations.length === 0" description="暂无场地，请先解析剧本" />
      <NGrid v-else cols="1 s:2 m:3" responsive="screen" x-gap="16" y-gap="16">
        <NGi v-for="loc in locations" :key="loc.id">
          <NCard size="small" :title="loc.name">
            <div class="thumb">
              <NImage
                v-if="loc.imageUrl"
                width="100%"
                :src="loc.imageUrl"
                object-fit="cover"
                style="max-height: 160px; border-radius: 8px"
              />
              <div v-else class="thumb-placeholder">未定场图</div>
            </div>
            <NInput
              v-model:value="loc.imagePrompt"
              type="textarea"
              placeholder="定场图英文提示词"
              :rows="3"
              style="margin-top: 8px"
            />
            <NSpace style="margin-top: 8px" justify="end">
              <NButton size="small" :loading="savingId === loc.id" @click="save(loc)">保存</NButton>
              <NButton
                size="small"
                type="primary"
                :loading="generatingId === loc.id"
                @click="generate(loc)"
              >
                生成定场图
              </NButton>
            </NSpace>
          </NCard>
        </NGi>
      </NGrid>
    </NCard>
  </div>
</template>

<style scoped>
.thumb-placeholder {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-soft);
  border-radius: 8px;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
</style>
