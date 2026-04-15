<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NButton, NSpace, useMessage, useDialog, NSpin, NEmpty, NTooltip } from 'naive-ui'
import { useEpisodeStore } from '@/stores/episode'
import { useEpisodeStoryboardPipelineJob } from '@/composables/useEpisodeStoryboardPipelineJob'
import { api } from '@/api'
import type { Episode } from '@dreamer/shared/types'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const episodeStore = useEpisodeStore()

const projectId = computed(() => route.params.id as string)
const episodeId = computed(() => route.params.episodeId as string)

const episode = ref<Episode | null>(null)
const notFound = ref(false)
const composingId = ref(false)

const { runningByEpisodeId: storyboardJobRunningByEpisode, refresh: refreshStoryboardPipelineJobs } =
  useEpisodeStoryboardPipelineJob(projectId)

const storyboardJobRunning = computed(
  () => storyboardJobRunningByEpisode.value[episodeId.value] === true
)

async function load() {
  notFound.value = false
  episode.value = null
  try {
    const data = await episodeStore.getEpisode(episodeId.value)
    if (data.projectId !== projectId.value) {
      notFound.value = true
      return
    }
    episode.value = data
  } catch {
    notFound.value = true
  }
}

onMounted(() => {
  void load()
})

watch(
  () => [projectId.value, episodeId.value] as const,
  () => {
    void load()
  }
)

watch(storyboardJobRunning, (on, was) => {
  if (was === true && on === false) {
    void load()
  }
})

function goBack() {
  router.push(`/project/${projectId.value}/episodes`)
}

function openStoryboard() {
  router.push({
    path: `/project/${projectId.value}/storyboard`,
    query: { episodeId: episodeId.value }
  })
}

function openGenerateStoryboardDialog() {
  if (episode.value?.listStats?.storyboardScriptJobCompleted) {
    message.warning('本集已使用 AI 生成分镜脚本，仅支持操作一次')
    return
  }
  if (storyboardJobRunning.value) {
    message.warning('分镜剧本任务已在运行中')
    return
  }
  dialog.warning({
    title: 'AI 生成分镜脚本',
    content:
      '将使用本集梗概与（若存在）已有剧本中的场次/梗概；生成后会替换当前集场次，并写入多镜 Shot、CharacterShot 与台词（若模型输出包含 shots）。',
    positiveText: '开始生成',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const data = await episodeStore.generateStoryboardScript(episodeId.value)
        message.success(
          data.message ||
            `任务已提交（${data.jobId}），请稍后在任务中心查看进度，完成后刷新本页或分镜控制台`
        )
        await refreshStoryboardPipelineJobs()
        await load()
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string; message?: string } } }
        const d = err?.response?.data
        message.error(d?.error || d?.message || '生成失败')
        throw e
      }
    }
  })
}

async function composeEpisode() {
  composingId.value = true
  try {
    const res = await api.post<{ outputUrl?: string; compositionId?: string }>(
      `/episodes/${episodeId.value}/compose`,
      {}
    )
    message.success(res.data.outputUrl ? '本集成片已导出' : '合成完成')
    if (res.data.outputUrl) {
      window.open(res.data.outputUrl, '_blank', 'noopener')
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string; details?: string[] } } }
    const d = err?.response?.data
    message.error(d?.error || d?.details?.join?.('; ') || '合成失败')
  } finally {
    composingId.value = false
  }
}

const titleLine = computed(() => {
  const ep = episode.value
  if (!ep) return ''
  return ep.title?.trim() || `第 ${ep.episodeNum} 集`
})

const storyboardScriptLocked = computed(
  () => episode.value?.listStats?.storyboardScriptJobCompleted === true
)

const storyboardAiDisabled = computed(
  () =>
    storyboardScriptLocked.value ||
    storyboardJobRunning.value
)
</script>

<template>
  <div class="episode-detail">
    <NSpin :show="episodeStore.isLoading && !episode && !notFound" description="加载中…">
      <NEmpty v-if="notFound" description="分集不存在或无权访问">
        <template #extra>
          <NButton @click="goBack">返回分集列表</NButton>
        </template>
      </NEmpty>

      <template v-else-if="episode">
        <div class="episode-detail__toolbar">
          <NButton quaternary size="small" @click="goBack">← 返回分集列表</NButton>
        </div>

        <NSpin
          :show="storyboardJobRunning"
          size="small"
          description="分镜剧本生成中…"
          class="episode-detail-card-spin"
        >
          <NCard :title="`第 ${episode.episodeNum} 集`">
            <h2 class="episode-detail__heading">{{ titleLine }}</h2>
            <p v-if="episode.synopsis?.trim()" class="episode-detail__synopsis">{{ episode.synopsis }}</p>
            <p v-else class="episode-detail__synopsis episode-detail__synopsis--muted">暂无梗概</p>

            <NSpace class="episode-detail__actions" :size="8" wrap>
              <NButton size="small" :disabled="storyboardJobRunning" @click="openStoryboard">分镜控制台</NButton>
              <NTooltip
                v-if="storyboardScriptLocked"
                placement="top"
              >
                <template #trigger>
                  <NButton
                    size="small"
                    type="info"
                    :loading="storyboardJobRunning"
                    :disabled="storyboardAiDisabled"
                    @click="openGenerateStoryboardDialog"
                  >
                    AI 生成分镜
                  </NButton>
                </template>
                本集已使用 AI 生成分镜脚本，仅支持操作一次
              </NTooltip>
              <NTooltip
                v-else-if="storyboardJobRunning"
                placement="top"
              >
                <template #trigger>
                  <NButton
                    size="small"
                    type="info"
                    :loading="true"
                    disabled
                    @click.prevent
                  >
                    AI 生成分镜
                  </NButton>
                </template>
                分镜剧本任务运行中，请稍候
              </NTooltip>
              <NButton
                v-else
                size="small"
                type="info"
                :disabled="storyboardAiDisabled"
                @click="openGenerateStoryboardDialog"
              >
                AI 生成分镜
              </NButton>
              <NButton
                size="small"
                type="primary"
                :loading="composingId"
                :disabled="storyboardJobRunning"
                @click="composeEpisode"
              >
                一键合成成片
              </NButton>
            </NSpace>
          </NCard>
        </NSpin>
      </template>
    </NSpin>
  </div>
</template>

<style scoped>
.episode-detail {
  width: 100%;
}
.episode-detail__toolbar {
  margin-bottom: var(--spacing-md);
}
.episode-detail__heading {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}
.episode-detail__synopsis {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}
.episode-detail__synopsis--muted {
  color: var(--color-text-tertiary);
}
.episode-detail__actions {
  margin-top: var(--spacing-lg);
}
.episode-detail-card-spin :deep(.n-spin-content) {
  min-height: 0;
}
</style>
