<script setup lang="ts">
import { NCard, NButton, NInputNumber, NTooltip } from 'naive-ui'

defineProps<{
  targetEpisodeCount: number
  effectiveTarget: number
  minTargetEpisodes: number
  maxTargetEpisodes: number
  episodePresets: readonly number[]
  batchButtonDisabled: boolean
  batchActionLabel: string
  isBatching: boolean
  batchAllTargetReady: boolean
  episode1HasScript: boolean
  isParseOutlineRunning: boolean
  isGeneratingFirst: boolean
  episodesWithScriptCount: number
  batchProgressMessage: string | null
  needsBatchEpisodes: boolean
}>()

defineEmits<{
  (e: 'update-target', v: number | null): void
  (e: 'batch'): void
}>()
</script>

<template>
  <NCard class="mt script-gen-card" title="剧本生成">
    <div class="episode-count-row">
      <div class="episode-count-inline">
        <NTooltip placement="top-start" :delay="200">
          <template #trigger>
            <span class="episode-count-label">总集数</span>
          </template>
          范围 {{ minTargetEpisodes }}–{{ maxTargetEpisodes }}。解析与批量补全均按此数值；仅 1
          集时无需批量。
        </NTooltip>
        <NInputNumber
          :value="targetEpisodeCount"
          :min="minTargetEpisodes"
          :max="maxTargetEpisodes"
          :step="1"
          size="small"
          class="episode-count-input"
          @update:value="$emit('update-target', $event)"
        />
        <span class="episode-count-unit">集</span>
      </div>
    </div>
    <div class="episode-presets">
      <span class="episode-presets-label">快捷</span>
      <NButton
        v-for="n in episodePresets"
        :key="n"
        size="tiny"
        :type="effectiveTarget === n ? 'primary' : 'default'"
        quaternary
        @click="$emit('update-target', n)"
      >
        {{ n }}
      </NButton>
    </div>
    <p
      v-if="episode1HasScript && !isBatching && !isParseOutlineRunning && !isGeneratingFirst"
      class="ok-line"
    >
      <template v-if="batchAllTargetReady">
        目标 {{ effectiveTarget }} 集剧本已全部生成，可直接解析或微调总集数后再次补全。
      </template>
      <template v-else-if="episodesWithScriptCount > 1">
        已生成 {{ episodesWithScriptCount }}/{{ effectiveTarget }} 集，点击⬇️可批量补全
      </template>
      <template v-else>
        第一集已生成；目标 {{ effectiveTarget }} 集{{
          needsBatchEpisodes ? '，其余集请点下方批量。' : '。'
        }}
      </template>
    </p>
    <p v-if="isBatching && batchProgressMessage" class="muted">
      {{ batchProgressMessage }}
    </p>
    <div class="mt-sm">
      <NButton
        :type="batchAllTargetReady ? 'success' : 'primary'"
        :loading="isBatching"
        :disabled="batchButtonDisabled"
        @click="$emit('batch')"
      >
        {{ batchActionLabel }}
      </NButton>
    </div>
    <p v-if="needsBatchEpisodes && episode1HasScript && !batchAllTargetReady" class="hint">
      批量生成较耗时，后台执行；可离开，稍后在任务中心看进度。
    </p>
  </NCard>
</template>

<style scoped>
.mt {
  margin-top: var(--spacing-md);
}

.mt-sm {
  margin-top: var(--spacing-sm);
}

.muted {
  color: var(--color-text-tertiary);
}

.ok-line {
  color: var(--color-success, #18a058);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-sm);
}

.script-gen-card :deep(.n-card-header) {
  padding-bottom: 12px;
}

.episode-count-row {
  margin-bottom: 12px;
}

.episode-count-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  justify-content: flex-start;
}

.episode-count-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: default;
}

.episode-count-input {
  width: 100px;
}

.episode-count-unit {
  font-size: 13px;
  color: #9ca3af;
  user-select: none;
}

.episode-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.episode-presets-label {
  font-size: 12px;
  color: #9ca3af;
  margin-right: 4px;
}
</style>
