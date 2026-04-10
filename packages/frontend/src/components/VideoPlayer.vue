<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NModal } from 'naive-ui'

const props = defineProps<{
  show: boolean
  videoUrl?: string
  thumbnailUrl?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const playbackRate = ref(1)
const showControls = ref(true)
const isFullscreen = ref(false)

let hideControlsTimeout: number | null = null

const formattedTime = computed(() => {
  const formatSeconds = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `${formatSeconds(currentTime.value)} / ${formatSeconds(duration.value)}`
})

const progress = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const togglePlay = () => {
  if (!videoRef.value) return
  if (isPlaying.value) {
    videoRef.value.pause()
  } else {
    videoRef.value.play()
  }
}

const handleTimeUpdate = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

const handleLoadedMetadata = () => {
  if (videoRef.value) {
    duration.value = videoRef.value.duration
  }
}

const handleSeek = (e: MouseEvent) => {
  if (!videoRef.value) return
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  videoRef.value.currentTime = percent * duration.value
}

const toggleMute = () => {
  if (!videoRef.value) return
  isMuted.value = !isMuted.value
  videoRef.value.muted = isMuted.value
}

const handleVolumeChange = (e: Event) => {
  const value = parseFloat((e.target as HTMLInputElement).value)
  volume.value = value
  if (videoRef.value) {
    videoRef.value.volume = value
    isMuted.value = value === 0
  }
}

const setPlaybackRate = (rate: number) => {
  playbackRate.value = rate
  if (videoRef.value) {
    videoRef.value.playbackRate = rate
  }
}

const stepFrame = (forward: boolean) => {
  if (!videoRef.value) return
  const frameTime = 0.033
  if (forward) {
    videoRef.value.currentTime = Math.min(videoRef.value.currentTime + frameTime, duration.value)
  } else {
    videoRef.value.currentTime = Math.max(videoRef.value.currentTime - frameTime, 0)
  }
}

const toggleFullscreen = () => {
  if (!videoRef.value) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
    isFullscreen.value = false
  } else {
    videoRef.value.requestFullscreen()
    isFullscreen.value = true
  }
}

const handleMouseMove = () => {
  showControls.value = true
  if (hideControlsTimeout) {
    clearTimeout(hideControlsTimeout)
  }
  hideControlsTimeout = window.setTimeout(() => {
    if (isPlaying.value) {
      showControls.value = false
    }
  }, 3000)
}

const close = () => {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :style="{ width: '90%', maxWidth: '900px' }"
    :title="null"
    @update:show="(v) => emit('update:show', v)"
  >
    <div class="video-player" @mousemove="handleMouseMove">
      <video
        ref="videoRef"
        :src="videoUrl"
        :poster="thumbnailUrl"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @click="togglePlay"
      />

      <div v-if="showControls" class="controls-overlay">
        <div class="progress-bar" @click="handleSeek">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>

        <div class="controls">
          <div class="controls-left">
            <button class="control-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
              <svg v-if="isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>

            <button class="control-btn" @click="stepFrame(false)" title="后退一帧">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
              </svg>
            </button>
            <button class="control-btn" @click="stepFrame(true)" title="前进一帧">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
              </svg>
            </button>

            <span class="time-display">{{ formattedTime }}</span>
          </div>

          <div class="controls-right">
            <div class="volume-control">
              <button class="control-btn" @click="toggleMute" :title="isMuted ? '静音' : '声音'">
                <svg v-if="isMuted || volume === 0" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="volume"
                @input="handleVolumeChange"
                class="volume-slider"
              />
            </div>

            <select
              :value="playbackRate"
              @change="(e) => setPlaybackRate(parseFloat((e.target as HTMLSelectElement).value))"
              class="speed-select"
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>

            <button class="control-btn" @click="toggleFullscreen" title="全屏">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="!isPlaying && !showControls" class="play-overlay" @click="togglePlay">
        <div class="play-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.video-player {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-player video {
  width: 100%;
  display: block;
  cursor: pointer;
}

.controls-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
  padding: 20px 16px 16px;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary, #6366f1);
  border-radius: 2px;
  transition: width 0.1s;
}

.progress-bar:hover {
  height: 8px;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 6px 8px;
  opacity: 0.9;
  transition: opacity 0.2s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.time-display {
  color: #fff;
  font-size: 13px;
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.volume-slider {
  width: 60px;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
}

.speed-select {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.speed-select option {
  background: #333;
  color: #fff;
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.play-icon {
  color: #fff;
  opacity: 0.9;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
