<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NButton, NSpace, useMessage, NTag } from 'naive-ui'
import { useEpisodeStore } from '@/stores/episode'
import { useSceneStore } from '@/stores/scene'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const episodeStore = useEpisodeStore()
const sceneStore = useSceneStore()

const projectId = computed(() => route.params.id as string)
const selectedEpisodeId = ref<string | null>(null)
const composingId = ref<string | null>(null)

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
  if (episodeStore.episodes.length > 0) {
    selectedEpisodeId.value = episodeStore.episodes[0].id
    await sceneStore.fetchScenes(selectedEpisodeId.value)
  }
})

async function selectEpisode(id: string) {
  selectedEpisodeId.value = id
  await sceneStore.fetchScenes(id)
}

function openStoryboard() {
  router.push(`/project/${projectId.value}/storyboard`)
}

async function composeEpisode(episodeId: string) {
  composingId.value = episodeId
  try {
    const res = await api.post<{ outputUrl?: string; compositionId?: string }>(
      `/episodes/${episodeId}/compose`,
      {}
    )
    message.success(res.data.outputUrl ? '本集成片已导出' : '合成完成')
    if (res.data.outputUrl) {
      window.open(res.data.outputUrl, '_blank', 'noopener')
    }
  } catch (e: any) {
    const d = e?.response?.data
    message.error(d?.error || d?.details?.join?.('; ') || '合成失败')
  } finally {
    composingId.value = null
  }
}
</script>

<template>
  <NSpace vertical size="large" style="width: 100%">
    <NCard title="分集管理">
      <template #header-extra>
        <NButton size="small" type="primary" @click="openStoryboard">打开分镜控制台</NButton>
      </template>
      <div class="layout">
        <NCard size="small" title="分集列表" class="side">
          <div
            v-for="ep in episodeStore.episodes"
            :key="ep.id"
            class="ep-item"
            :class="{ active: selectedEpisodeId === ep.id }"
            @click="selectEpisode(ep.id)"
          >
            <div class="ep-item__title">
              第 {{ ep.episodeNum }} 集
              <NTag v-if="selectedEpisodeId === ep.id" size="small" type="info">当前</NTag>
            </div>
            <div class="ep-item__desc">{{ ep.title || ep.synopsis?.slice(0, 80) || '—' }}</div>
          </div>
        </NCard>
        <NCard size="small" title="当前集场次" class="main">
          <p v-if="!selectedEpisodeId" class="muted">请选择一集</p>
          <template v-else>
            <p class="muted">
              共 {{ sceneStore.scenes.length }} 场 · 在分镜控制台中可批量生成视频、选择 Take。
            </p>
            <NSpace>
              <NButton @click="openStoryboard">去分镜控制台</NButton>
              <NButton
                type="primary"
                :loading="composingId === selectedEpisodeId"
                @click="composeEpisode(selectedEpisodeId!)"
              >
                一键合成成片（按已选 Take）
              </NButton>
            </NSpace>
          </template>
        </NCard>
      </div>
    </NCard>
  </NSpace>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.ep-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 8px;
  border: 1px solid transparent;
}
.ep-item:hover {
  background: var(--color-bg-soft);
}
.ep-item.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light-1, rgba(99, 102, 241, 0.08));
}
.ep-item__title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ep-item__desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
.muted {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  margin-bottom: 12px;
}
</style>
