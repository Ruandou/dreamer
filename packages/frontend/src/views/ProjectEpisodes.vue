<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NGrid,
  NGi,
  NInput,
  NTooltip,
  useMessage,
  useDialog
} from 'naive-ui'
import { useEpisodeStore } from '@/stores/episode'
import { useEpisodeStoryboardPipelineJob } from '@/composables/useEpisodeStoryboardPipelineJob'
import type { Episode } from '@dreamer/shared/types'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const episodeStore = useEpisodeStore()

const projectId = computed(() => route.params.id as string)
const searchQuery = ref('')
/** 二次确认弹窗打开中：禁止操作其他集；与 PipelineJob 无关，不显示卡片 loading */
const storyboardDialogEpisodeId = ref<string | null>(null)

const {
  runningByEpisodeId: storyboardJobRunningByEpisode,
  refresh: refreshStoryboardPipelineJobs
} = useEpisodeStoryboardPipelineJob(projectId)

const filteredEpisodes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = episodeStore.episodes
  if (!q) return list
  return list.filter((ep) => {
    const title = (ep.title || '').toLowerCase()
    const syn = (ep.synopsis || '').toLowerCase()
    const numStr = String(ep.episodeNum)
    return title.includes(q) || syn.includes(q) || numStr.includes(q)
  })
})

const episodeBannerColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

function episodeBannerStyle(ep: Episode) {
  const c = episodeBannerColors[ep.episodeNum % episodeBannerColors.length]
  return {
    background: `linear-gradient(135deg, ${c}22 0%, var(--color-bg-gray) 100%)`,
    borderBottom: `3px solid ${c}44`
  }
}

function episodeCardTitle(ep: Episode): string {
  return ep.title?.trim() || `第 ${ep.episodeNum} 集`
}

/** 有入库场次时展示分镜场数；否则展示剧本场数/角色数 */
function episodeStatsLine(ep: Episode): string {
  const s = ep.listStats
  if (!s) return ''
  if (s.hasStoryboardScenes) {
    return `分镜 ${s.storyboardSceneCount} 场 · ${s.storyboardCharacterCount} 个角色`
  }
  if (s.scriptSceneCount > 0 || s.scriptCharacterCount > 0) {
    return `剧本 ${s.scriptSceneCount} 场 · ${s.scriptCharacterCount} 个角色`
  }
  return ''
}

function goEpisodeDetail(episodeId: string) {
  void router.push({
    name: 'ProjectEpisodeDetail',
    params: { id: projectId.value, episodeId }
  })
}

function onEpisodeCardClick(ep: Episode) {
  if (storyboardDialogEpisodeId.value !== null) return
  goEpisodeDetail(ep.id)
}

function onEpisodeCardEnter(ep: Episode) {
  if (storyboardDialogEpisodeId.value !== null) return
  goEpisodeDetail(ep.id)
}

function isStoryboardJobRunning(ep: Episode): boolean {
  return storyboardJobRunningByEpisode.value[ep.id] === true
}

/** 本集「AI 生成分镜」是否应禁用（他集弹窗、本集弹窗、Pipeline 任务运行中、已用过一次） */
function isStoryboardAiDisabled(ep: Episode): boolean {
  if (ep.listStats?.storyboardScriptJobCompleted) return true
  if (isStoryboardJobRunning(ep)) return true
  const dlg = storyboardDialogEpisodeId.value
  if (dlg !== null && dlg !== ep.id) return true
  if (dlg === ep.id) return true
  return false
}

function openGenerateStoryboardDialog(ep: Episode) {
  if (ep.listStats?.storyboardScriptJobCompleted) {
    message.warning('本集已使用 AI 生成分镜脚本，仅支持操作一次')
    return
  }
  if (storyboardDialogEpisodeId.value !== null) {
    message.warning('已有分集正在操作，请稍候')
    return
  }
  const episodeId = ep.id
  storyboardDialogEpisodeId.value = episodeId
  dialog.warning({
    title: 'AI 生成分镜脚本',
    content:
      '将使用本集梗概与（若存在）已有剧本中的场次/梗概；生成后会替换当前集场次，并写入多镜 Shot、CharacterShot 与台词（若模型输出包含 shots）。',
    positiveText: '开始生成',
    negativeText: '取消',
    onNegativeClick: () => {
      storyboardDialogEpisodeId.value = null
    },
    onPositiveClick: async () => {
      try {
        const data = await episodeStore.generateStoryboardScript(episodeId)
        message.success(
          data.message ||
            `任务已提交（${data.jobId}），请稍后在任务中心查看进度，完成后刷新分集或分镜控制台`
        )
        await refreshStoryboardPipelineJobs()
        await episodeStore.fetchEpisodes(projectId.value)
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string; message?: string } } }
        const d = err?.response?.data
        message.error(d?.error || d?.message || '生成失败')
        throw e
      } finally {
        storyboardDialogEpisodeId.value = null
      }
    }
  })
}

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
})

/** 分镜 PipelineJob 从运行变为结束：刷新列表上的 listStats 等 */
watch(
  storyboardJobRunningByEpisode,
  (next, prev) => {
    if (!prev || Object.keys(prev).length === 0) return
    for (const id of Object.keys(prev)) {
      if (prev[id] && !next[id]) {
        void episodeStore.fetchEpisodes(projectId.value)
        break
      }
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="episodes-page">
    <NCard>
      <template #header>
        <div class="ep-lib-header">
          <div class="ep-lib-header-left">
            <span class="ep-lib-title">分集管理</span>
            <span class="ep-lib-stat muted">共 {{ episodeStore.episodes.length }} 集</span>
          </div>
          <NInput
            v-model:value="searchQuery"
            clearable
            round
            size="small"
            placeholder="搜索集数、标题、梗概…"
            class="ep-lib-search"
          >
            <template #prefix>
              <span class="ep-lib-search-icon" aria-hidden="true">⌕</span>
            </template>
          </NInput>
        </div>
      </template>

      <p class="ep-lib-hint">
        点击卡片进入分集详情；提交「AI
        生成分镜」后任务在后台运行，对应集卡片会显示加载直至任务结束。视频生成、选 Take
        请在「分镜控制台」中操作。
      </p>

      <div
        v-if="episodeStore.isLoading && episodeStore.episodes.length === 0"
        class="ep-lib-loading"
      >
        <SkeletonLoader variant="grid" :rows="3" />
      </div>
      <div v-else class="ep-lib-body">
        <EmptyState
          v-if="episodeStore.episodes.length === 0"
          title="暂无分集"
          description="请先在剧本侧新建或导入剧本以生成分集"
          icon="📺"
          :icon-size="48"
          variant="large"
        />

        <EmptyState
          v-else-if="filteredEpisodes.length === 0"
          title="没有匹配的分集"
          :description="`未找到包含「${searchQuery}」的分集`"
          icon="🔍"
          :icon-size="48"
        >
          <template #action>
            <NButton size="small" @click="searchQuery = ''">清空搜索</NButton>
          </template>
        </EmptyState>

        <NGrid
          v-else-if="episodeStore.episodes.length > 0"
          cols="1 s:2 m:3"
          responsive="screen"
          x-gap="16"
          y-gap="16"
          class="ep-lib-grid"
        >
          <NGi v-for="ep in filteredEpisodes" :key="ep.id">
            <NCard
              size="small"
              class="episode-card"
              hoverable
              :segmented="{ footer: 'soft' }"
              role="link"
              tabindex="0"
              @click="onEpisodeCardClick(ep)"
              @keydown.enter.prevent="onEpisodeCardEnter(ep)"
            >
              <div class="episode-card__inner">
                <div class="episode-card__banner" :style="episodeBannerStyle(ep)">
                  <span class="episode-card__num">第 {{ ep.episodeNum }} 集</span>
                </div>
                <div class="episode-card__info">
                  <h3 class="episode-card__name">{{ episodeCardTitle(ep) }}</h3>
                  <p v-if="ep.synopsis?.trim()" class="episode-card__desc">{{ ep.synopsis }}</p>
                  <p v-else class="episode-card__desc episode-card__desc--placeholder">暂无梗概</p>
                  <p v-if="episodeStatsLine(ep)" class="episode-card__stats">
                    {{ episodeStatsLine(ep) }}
                  </p>
                </div>
              </div>
              <template #footer>
                <div class="episode-card__footer" @click.stop>
                  <NSpace justify="end">
                    <NTooltip
                      :disabled="!ep.listStats?.storyboardScriptJobCompleted"
                      placement="top"
                    >
                      <template #trigger>
                        <NButton
                          size="small"
                          type="info"
                          :loading="isStoryboardJobRunning(ep)"
                          :disabled="isStoryboardAiDisabled(ep)"
                          @click="openGenerateStoryboardDialog(ep)"
                        >
                          AI 生成分镜
                        </NButton>
                      </template>
                      本集已使用 AI 生成分镜脚本，仅支持操作一次
                    </NTooltip>
                  </NSpace>
                </div>
              </template>
            </NCard>
          </NGi>
        </NGrid>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.episodes-page {
  width: 100%;
}
.ep-lib-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}
.ep-lib-header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
.ep-lib-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}
.ep-lib-stat {
  font-size: var(--font-size-sm);
  white-space: nowrap;
}
.ep-lib-stat.muted {
  color: var(--color-text-tertiary);
}
.ep-lib-search {
  width: 200px;
  max-width: 100%;
  min-width: 0;
}
.ep-lib-search-icon {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.ep-lib-hint {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
.ep-lib-loading {
  min-height: 120px;
}
.ep-lib-body {
  min-height: 80px;
}
.ep-lib-search-empty {
  padding: var(--spacing-xl) 0;
}
.ep-lib-grid {
  margin-bottom: 0;
}
:deep(.n-card-header__main) {
  min-width: 0;
  overflow: hidden;
}
.episode-card {
  overflow: hidden;
  cursor: pointer;
  outline: none;
  transition:
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
  border: 1px solid var(--color-border-light);
}
.episode-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
.episode-card:focus-visible {
  box-shadow: 0 0 0 2px var(--color-primary-light-1, rgba(99, 102, 241, 0.35));
}
.episode-card__inner {
  margin: calc(var(--spacing-md) * -1);
  padding: var(--spacing-md);
}
.episode-card__banner {
  margin: calc(var(--spacing-md) * -1) calc(var(--spacing-md) * -1) var(--spacing-md);
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-gray);
}
.episode-card__num {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
}
.episode-card__info {
  margin-bottom: 0;
}
.episode-card__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-xs);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.episode-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
  margin: 0;
}
.episode-card__desc--placeholder {
  color: var(--color-text-tertiary);
}
.episode-card__stats {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  line-height: var(--line-height-normal);
}
.episode-card__footer {
  padding: 0;
}
.episode-card-spin {
  display: block;
  width: 100%;
}
.episode-card-spin :deep(.n-spin-content) {
  min-height: 0;
}
.episode-card-spin--busy :deep(.n-spin-content) {
  min-height: 200px;
}
</style>
