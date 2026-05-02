<template>
  <div class="outline-page">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!hasEpisodes" class="empty">
      <NEmpty description="暂无大纲">
        <template #extra>
          <NButton type="primary" @click="goToTemplates">去模板库生成大纲</NButton>
        </template>
      </NEmpty>
    </div>
    <template v-else>
      <div class="outline-header">
        <h2>剧集大纲</h2>
        <NSpace>
          <NButton size="small" @click="goToTemplates">更换模板</NButton>
          <NButton type="primary" size="small" @click="startWriting">开始写作</NButton>
        </NSpace>
      </div>

      <div class="outline-timeline">
        <div
          v-for="ep in episodes"
          :key="ep.episodeNum"
          class="episode-row"
          :class="{ paywall: ep.isPaywall }"
        >
          <div class="episode-num">
            <span class="num">{{ ep.episodeNum }}</span>
            <NTag v-if="ep.isPaywall" size="tiny" type="warning">付费</NTag>
          </div>
          <div class="episode-content">
            <NInput
              v-model:value="ep.title"
              size="small"
              placeholder="标题"
              class="ep-title"
              @blur="saveEpisode(ep)"
            />
            <NInput
              v-model:value="ep.synopsis"
              size="small"
              type="textarea"
              :rows="2"
              placeholder="一句话梗概"
              class="ep-synopsis"
              @blur="saveEpisode(ep)"
            />
            <div class="ep-hooks">
              <NInput
                v-model:value="ep.hook"
                size="tiny"
                placeholder="开头钩子"
                class="ep-hook"
                @blur="saveEpisode(ep)"
              />
              <NInput
                v-model:value="ep.cliffhanger"
                size="tiny"
                placeholder="结尾悬念"
                class="ep-cliffhanger"
                @blur="saveEpisode(ep)"
              />
            </div>
          </div>
          <div class="episode-status">
            <NTag
              :type="
                ep.writeStatus === 'completed'
                  ? 'success'
                  : ep.writeStatus === 'writing'
                    ? 'warning'
                    : 'default'
              "
              size="tiny"
            >
              {{ statusLabel(ep.writeStatus) }}
            </NTag>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NEmpty, NButton, NInput, NTag, NSpace, useMessage } from 'naive-ui'
import { api } from '../../api'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const projectId = route.params.id as string
const loading = ref(true)
const outline = ref<any>(null)
const episodes = ref<any[]>([])

const hasEpisodes = computed(() => episodes.value.length > 0)

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '未开始',
    writing: '写作中',
    completed: '已完成'
  }
  return map[status] || status
}

async function loadOutline() {
  loading.value = true
  try {
    const res = await api.get(`/outlines/${projectId}`)
    outline.value = res.data.outline
    episodes.value = res.data.episodes || []
  } catch {
    message.error('加载大纲失败')
  } finally {
    loading.value = false
  }
}

async function saveEpisode(ep: any) {
  try {
    await api.put(`/outlines/${projectId}/episodes/${ep.episodeNum}`, {
      title: ep.title,
      synopsis: ep.synopsis,
      hook: ep.hook,
      cliffhanger: ep.cliffhanger,
      isPaywall: ep.isPaywall
    })
  } catch {
    // silent fail
  }
}

function goToTemplates() {
  router.push('/templates')
}

function startWriting() {
  router.push(`/project/${projectId}/write`)
}

onMounted(loadOutline)
</script>

<style scoped>
.outline-page {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.loading,
.empty {
  padding: 60px 20px;
  text-align: center;
}

.outline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.outline-header h2 {
  margin: 0;
  font-size: 20px;
}

.outline-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.episode-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  transition: all 0.2s;
}

.episode-row:hover {
  border-color: var(--color-border);
  box-shadow: var(--shadow-sm);
}

.episode-row.paywall {
  border-left: 3px solid #f59e0b;
}

.episode-num {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 48px;
  flex-shrink: 0;
}

.num {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.episode-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ep-title {
  font-weight: 500;
}

.ep-synopsis {
  font-size: 13px;
}

.ep-hooks {
  display: flex;
  gap: 8px;
}

.ep-hook,
.ep-cliffhanger {
  flex: 1;
}

.episode-status {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
}
</style>
