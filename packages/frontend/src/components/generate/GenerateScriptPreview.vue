<script setup lang="ts">
import { NCard, NButton, NScrollbar } from 'naive-ui'

interface Episode {
  id: string
  episodeNum?: number | string
  title?: string
  script: unknown
}

defineProps<{
  episodesWithScript: Episode[]
  activePreviewEpisode: Episode | null
  previewEpisodeNum: number
  previewScenes: Array<{
    sceneNum: number | string
    location: string
    timeOfDay: string
    description: string
  }>
  showFullEpisode: boolean
  isGeneratingFirst: boolean
  isBatching: boolean
  isParseOutlineRunning: boolean
  needsBatchEpisodes: boolean
  allEpisodesReady: boolean
  effectiveTarget: number
}>()

defineEmits<{
  (e: 'toggle-full'): void
  (e: 'select-episode', n: number): void
  (e: 'generate-first'): void
}>()

function scenesFromRaw(raw: unknown): any[] {
  let o: unknown = raw
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!o || typeof o !== 'object') return []
  const s = (o as any).scenes
  return Array.isArray(s) ? s : []
}

function epNum(e: Episode): number {
  return Number(e?.episodeNum)
}
</script>

<template>
  <NCard class="mt preview-script-card" title="剧本预览">
    <template #header-extra>
      <NButton
        v-if="activePreviewEpisode && scenesFromRaw(activePreviewEpisode.script).length"
        size="tiny"
        quaternary
        @click="$emit('toggle-full')"
      >
        {{ showFullEpisode ? '收起' : '展开' }}
      </NButton>
    </template>
    <p
      v-if="episodesWithScript.length > 1 && needsBatchEpisodes && allEpisodesReady"
      class="episode-picker episode-picker--ok"
    >
      目标 {{ effectiveTarget }} 集均已就绪，可前往下方「解析剧本」。
    </p>
    <p v-else-if="episodesWithScript.length > 1 && !allEpisodesReady" class="muted episode-picker">
      当前已生成 {{ episodesWithScript.length }} 集有场次；凑满目标
      {{ effectiveTarget }} 集后再解析更稳妥。
    </p>
    <div
      v-if="!activePreviewEpisode || !scenesFromRaw(activePreviewEpisode.script).length"
      class="muted"
    >
      <p>暂无第一集剧本。从列表进入不会自动生成，请确认创意与梗概后点击下方按钮。</p>
      <NButton
        type="primary"
        class="mt-sm"
        :loading="isGeneratingFirst"
        :disabled="isGeneratingFirst || isBatching || isParseOutlineRunning"
        @click="$emit('generate-first')"
      >
        生成第一集剧本
      </NButton>
    </div>
    <div v-else class="script-preview-outer">
      <div class="preview-split">
        <div class="preview-ep-tablist-wrap">
          <NScrollbar class="preview-tab-scroll" trigger="hover">
            <nav class="preview-ep-tablist-inner" role="tablist" aria-label="选择预览集数">
              <button
                v-for="ep in episodesWithScript"
                :key="ep.id"
                type="button"
                role="tab"
                class="preview-ep-tab"
                :class="{ 'preview-ep-tab--active': epNum(ep) === previewEpisodeNum }"
                :aria-selected="epNum(ep) === previewEpisodeNum"
                @click="$emit('select-episode', epNum(ep))"
              >
                第 {{ epNum(ep) }} 集
              </button>
            </nav>
          </NScrollbar>
        </div>
        <div class="preview-ep-panel">
          <p v-if="(activePreviewEpisode as any)?.title" class="preview-ep-title">
            {{ (activePreviewEpisode as any).title }}
          </p>
          <div class="preview-scroll-wrap">
            <div class="script-preview">
              <div v-for="(sc, idx) in previewScenes" :key="idx" class="scene-block">
                <div class="scene-head">
                  Scene {{ sc.sceneNum }}. {{ sc.location }} - {{ sc.timeOfDay }}
                </div>
                <p class="scene-desc">{{ sc.description }}</p>
              </div>
              <p
                v-if="!showFullEpisode && scenesFromRaw(activePreviewEpisode.script).length > 2"
                class="expand-hint muted"
              >
                共 {{ scenesFromRaw(activePreviewEpisode.script).length }} 场，
                <NButton text type="primary" size="tiny" @click="$emit('toggle-full')">
                  展开查看全部
                </NButton>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.muted {
  color: var(--color-text-tertiary);
}

.episode-picker {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.episode-picker--ok {
  color: var(--color-success, #18a058);
  font-weight: 500;
}

.mt {
  margin-top: var(--spacing-md);
}

.mt-sm {
  margin-top: var(--spacing-sm);
}

.script-preview-outer {
  min-height: 0;
}

.preview-split {
  --preview-pane-max: min(58vh, 560px);
  --preview-scroll-max: min(58vh, 560px);
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-height: 0;
}

.preview-ep-tablist-wrap {
  flex-shrink: 0;
  width: 122px;
  min-height: 0;
  max-height: var(--preview-pane-max);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview-tab-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 10px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.preview-tab-scroll :deep(.n-scrollbar-container) {
  border-radius: 10px;
}

.preview-ep-tablist-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  box-sizing: border-box;
}

.preview-ep-tab {
  width: 100%;
  margin: 0;
  padding: 10px 10px;
  text-align: left;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.3;
  color: #6b7280;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  font-family: inherit;
}

.preview-ep-tab:hover {
  background: #e5e7eb;
  color: #111827;
}

.preview-ep-tab--active {
  background: #6366f1;
  color: #fff;
  font-weight: 600;
}

.preview-ep-tab--active:hover {
  background: #4f46e5;
  color: #fff;
}

.preview-ep-panel {
  --preview-title-offset: 0px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-height: var(--preview-pane-max);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-ep-panel:has(.preview-ep-title) {
  --preview-title-offset: 48px;
}

.preview-ep-title {
  flex-shrink: 0;
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.preview-scroll-wrap {
  flex: 0 1 auto;
  min-height: 0;
  max-height: calc(var(--preview-scroll-max) - var(--preview-title-offset));
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  border-radius: 12px;
}

.preview-script-card :deep(.n-card__content) {
  min-height: 0;
}

@media (max-width: 640px) {
  .preview-split {
    flex-direction: column;
    --preview-pane-max: min(50vh, 480px);
    --preview-scroll-max: min(50vh, 480px);
    --preview-pane-min: 0;
    height: auto;
    min-height: 0;
    max-height: none;
    overflow: visible;
  }

  .preview-ep-tablist-wrap {
    width: 100%;
    height: auto;
    min-height: 0;
    max-height: 112px;
  }

  .preview-tab-scroll {
    max-height: 112px;
  }

  .preview-ep-tablist-inner {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .preview-ep-tab {
    width: auto;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .preview-ep-panel {
    height: auto;
    min-height: 0;
    max-height: none;
  }

  .preview-scroll-wrap {
    flex: 0 1 auto;
    min-height: 220px;
  }
}

.script-preview {
  line-height: 1.65;
  font-size: 14px;
  padding: var(--spacing-md);
  border-radius: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.scene-block {
  margin-bottom: var(--spacing-md);
  padding: 14px 16px 14px 18px;
  background: #fff;
  border-radius: 10px;
  border-left: 3px solid #6366f1;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.scene-block:last-child {
  margin-bottom: 0;
}

.scene-head {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.scene-desc {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
}

.expand-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  margin-bottom: 0;
}
</style>
