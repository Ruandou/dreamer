<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NButton, NSpace, useMessage, NTag, useDialog, NCollapse, NCollapseItem } from 'naive-ui'
import { useEpisodeStore } from '@/stores/episode'
import { useSceneStore } from '@/stores/scene'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const episodeStore = useEpisodeStore()
const sceneStore = useSceneStore()

const projectId = computed(() => route.params.id as string)
const selectedEpisodeId = ref<string | null>(null)
const composingId = ref<string | null>(null)

onMounted(async () => {
  await episodeStore.fetchEpisodes(projectId.value)
  if (episodeStore.episodes.length > 0) {
    selectedEpisodeId.value = episodeStore.episodes[0].id
    await sceneStore.fetchEpisodeScenesDetail(selectedEpisodeId.value)
  }
})

async function selectEpisode(id: string) {
  selectedEpisodeId.value = id
  await sceneStore.fetchEpisodeScenesDetail(id)
}

function openStoryboard() {
  if (!selectedEpisodeId.value) {
    message.warning('请先选择一集')
    return
  }
  router.push({
    path: `/project/${projectId.value}/storyboard`,
    query: { episodeId: selectedEpisodeId.value }
  })
}

function openGenerateStoryboardDialog() {
  if (!selectedEpisodeId.value) {
    message.warning('请先选择一集')
    return
  }
  dialog.warning({
    title: 'AI 生成分镜脚本',
    content:
      '将使用本集梗概与（若存在）已有剧本中的场次/梗概；生成后会替换当前集场次，并写入多镜 Shot、CharacterShot 与台词（若模型输出包含 shots）。',
    positiveText: '开始生成',
    negativeText: '取消',
    onPositiveClick: async () => {
      const id = selectedEpisodeId.value
      if (!id) return
      try {
        const data = await episodeStore.generateStoryboardScript(id)
        message.success(
          data.message ||
            `任务已提交（${data.jobId}），请稍后在任务中心查看进度，完成后刷新本分集或分镜控制台`
        )
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string; message?: string } } }
        const d = err?.response?.data
        message.error(d?.error || d?.message || '生成失败')
        throw e
      }
    }
  })
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
              共 {{ sceneStore.editorScenes.length }} 场。视频生成、选 Take、批量操作请在「分镜控制台」中完成（先选分集）；每场一条 Seedance，多镜与台词由后端拼进同一次任务。
            </p>
            <NSpace>
              <NButton @click="openStoryboard">去分镜控制台</NButton>
              <NButton
                type="info"
                :loading="episodeStore.isGeneratingStoryboard"
                @click="openGenerateStoryboardDialog"
              >
                AI 生成分镜脚本
              </NButton>
              <NButton
                type="primary"
                :loading="composingId === selectedEpisodeId"
                @click="composeEpisode(selectedEpisodeId!)"
              >
                一键合成成片（按已选 Take）
              </NButton>
            </NSpace>
            <NCollapse v-if="sceneStore.editorScenes.length" style="margin-top: 12px">
              <NCollapseItem
                v-for="sc in sceneStore.editorScenes"
                :key="sc.id"
                :title="`第 ${sc.sceneNum} 场 · ${sc.location?.name || '未定场'} · ${sc.shots?.length || 0} 镜`"
              >
                <p class="scene-hint">本场所有镜头与台词在分镜控制台中会合并为一条 Seedance 提示词，产出一条视频。</p>
                <div v-if="sc.location?.imageUrl" class="thumb-row">
                  <span class="lbl">定场</span>
                  <img :src="sc.location.imageUrl" alt="" class="thumb" />
                </div>
                <div v-for="sh in sc.shots" :key="sh.id" class="shot-block">
                  <div class="shot-title">镜 {{ sh.shotNum }}</div>
                  <p class="shot-desc">{{ sh.description?.slice(0, 200) }}{{ (sh.description?.length || 0) > 200 ? '…' : '' }}</p>
                  <div class="thumb-row">
                    <div
                      v-for="cs in sh.characterShots"
                      :key="cs.id"
                      class="char-chip"
                    >
                      <img
                        v-if="cs.characterImage.avatarUrl"
                        :src="cs.characterImage.avatarUrl"
                        alt=""
                        class="thumb sm"
                      />
                      <span>{{ cs.characterImage.character.name }} · {{ cs.characterImage.name }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="sc.dialogues?.length" class="dialogues">
                  <div class="lbl">台词</div>
                  <ul>
                    <li v-for="d in sc.dialogues" :key="d.id">
                      {{ (d.startTimeMs / 1000).toFixed(1) }}s {{ d.character.name }}：{{ d.text }}
                    </li>
                  </ul>
                </div>
              </NCollapseItem>
            </NCollapse>
            <p class="muted hint-below">
              「AI 生成分镜脚本」会提交后台任务（任务中心可见），完成后覆盖本集场次；请先在剧本侧写好梗概或导入剧本。
            </p>
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
.hint-below {
  margin-top: 12px;
  margin-bottom: 0;
}
.thumb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.thumb {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}
.thumb.sm {
  width: 40px;
  height: 40px;
}
.lbl {
  font-size: 12px;
  color: var(--color-text-tertiary);
  min-width: 36px;
}
.shot-block {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}
.shot-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.shot-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 8px;
}
.char-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-right: 12px;
}
.dialogues {
  margin-top: 8px;
  font-size: 13px;
}
.dialogues ul {
  margin: 4px 0 0 1.2em;
  padding: 0;
}
.scene-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  display: block;
  line-height: 1.4;
}
</style>
