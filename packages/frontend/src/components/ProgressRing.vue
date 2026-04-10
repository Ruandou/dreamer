<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  percent: number
  size?: number
  strokeWidth?: number
  showText?: boolean
}>()

const size = computed(() => props.size || 60)
const strokeWidth = computed(() => props.strokeWidth || 4)
const showText = computed(() => props.showText ?? true)

const radius = computed(() => (size.value - strokeWidth.value) / 2)
const circumference = computed(() => radius.value * 2 * Math.PI)
const offset = computed(() => circumference.value - (props.percent / 100) * circumference.value)
</script>

<template>
  <div class="progress-ring" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" class="progress-ring__svg">
      <circle
        class="progress-ring__bg"
        :stroke-width="strokeWidth"
        :r="radius"
        :cx="size / 2"
        :cy="size / 2"
        fill="transparent"
      />
      <circle
        class="progress-ring__progress"
        :stroke-width="strokeWidth"
        :r="radius"
        :cx="size / 2"
        :cy="size / 2"
        fill="transparent"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
      />
    </svg>
    <div v-if="showText" class="progress-ring__text">
      {{ Math.round(percent) }}%
    </div>
  </div>
</template>

<style scoped>
.progress-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.progress-ring__svg {
  transform: rotate(-90deg);
}

.progress-ring__bg {
  stroke: var(--color-border);
}

.progress-ring__progress {
  stroke: var(--color-primary);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.35s;
}

.progress-ring__text {
  position: absolute;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
</style>
