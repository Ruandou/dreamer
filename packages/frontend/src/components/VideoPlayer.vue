<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NModal, NImage } from 'naive-ui'

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
  // Assuming 30fps, one frame is ~0.033 seconds
  const frameTime = 0.033
  if (forward) {
    videoRef.value.currentTime = Math.min(videoRef.value.currentTime + frameTime, duration.value)
  } else {
    videoRef.value.currentTime = Math.max(videoRef.value.currentTime - frameTime, 0)
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
    title="视频预览"
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
        <!-- Progress bar -->
        <div class="progress-bar" @click="handleSeek">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>

        <div class="controls">
          <div class="controls-left">
            <button class="control-btn" @click="togglePlay">
              {{ isPlaying ? '⏸' : '▶' }}
            </button>

            <button class="control-btn" @click="stepFrame(false)">
              ⏪
            </button>
            <button class="control-btn" @click="stepFrame(true)">
              ⏩
            </button>

            <span class="time-display">{{ formattedTime }}</span>
          </div>

          <div class="controls-right">
            <div class="volume-control">
              <button class="control-btn" @click="toggleMute">
                {{ isMuted ? '🔇' : '🔊' }}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
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
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="!isPlaying && !showControls" class="play-overlay" @click="togglePlay">
        <span class="play-icon">▶</span>
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
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
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
  background: #1890ff;
  border-radius: 2px;
  transition: width 0.1s;
}

.progress-bar:hover {
  height: 6px;
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
  gap: 8px;
}

.control-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.control-btn:hover {
  opacity: 1;
}

.time-display {
  color: #fff;
  font-size: 13px;
  margin-left: 8px;
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
  font-size: 64px;
  color: #fff;
  opacity: 0.8;
}
</style>
