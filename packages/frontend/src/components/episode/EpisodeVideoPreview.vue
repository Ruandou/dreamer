<script setup lang="ts">
import { computed } from 'vue'

interface Take {
  id: string
  status: string
  videoUrl?: string | null
  thumbnailUrl?: string | null
  isSelected?: boolean
  duration?: number | null
}

interface Scene {
  takes?: Take[]
  duration?: number
}

const props = defineProps<{
  scene: Scene | null
}>()

const previewTake = computed(() => {
  const sc = props.scene
  if (!sc?.takes?.length) return null
  const list = sc.takes
  const sel = list.find((t) => t.isSelected && t.videoUrl)
  if (sel) return sel
  const done = list.find((t) => t.status === 'completed' && t.videoUrl)
  return done ?? list[0]
})

const sceneDurationLabel = computed(() => {
  const ms = props.scene?.duration ?? 0
  if (ms <= 0) return '00:00'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
</script>

<template>
  <div class="episode-video-preview">
    <div class="episode-video-preview__label">预览</div>
    <div class="episode-video-preview__frame" aria-label="竖屏 9:16 预览区域">
      <div class="episode-video-preview__box">
        <video
          v-if="previewTake?.videoUrl"
          class="episode-video-preview__video"
          controls
          playsinline
          :src="previewTake.videoUrl"
          :poster="previewTake.thumbnailUrl ?? undefined"
        />
        <img
          v-else-if="previewTake?.thumbnailUrl"
          :src="previewTake.thumbnailUrl"
          alt=""
          class="episode-video-preview__poster"
        />
        <div v-else class="episode-video-preview__empty">
          <span class="episode-video-preview__empty-icon" aria-hidden="true">🎬</span>
          <span>未生成内容</span>
        </div>
      </div>
    </div>
    <div class="episode-video-preview__duration">00:00 / {{ sceneDurationLabel }}</div>
  </div>
</template>

<style scoped>
.episode-video-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.episode-video-preview__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.episode-video-preview__frame {
  width: 180px;
  aspect-ratio: 9 / 16;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-border-light);
}

.episode-video-preview__box {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.episode-video-preview__video,
.episode-video-preview__poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.episode-video-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.episode-video-preview__empty-icon {
  font-size: 32px;
}

.episode-video-preview__duration {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-family: monospace;
}
</style>
