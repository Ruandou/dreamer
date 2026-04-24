<script setup lang="ts">
import { onMounted } from 'vue'
import { NCard, NInput, NSkeleton, NSpin, NResult, NButton, NSpace } from 'naive-ui'
import { useGenerateEpisodes } from '@/composables/useGenerateEpisodes'
import GeneratePageToolbar from '@/components/generate/GeneratePageToolbar.vue'
import GenerateScriptPreview from '@/components/generate/GenerateScriptPreview.vue'
import GenerateEpisodeControl from '@/components/generate/GenerateEpisodeControl.vue'
import GenerateParseAction from '@/components/generate/GenerateParseAction.vue'

const {
  isLoading,
  generatingStatus,
  isGeneratingFirst,
  error,
  isBatching,
  isParseOutlineRunning,
  isParsing,
  showFullEpisode,
  previewEpisodeNum,
  targetEpisodeCount,
  batchProgress,
  project,
  projectId,
  MIN_TARGET_EPISODES,
  MAX_TARGET_EPISODES,
  EPISODE_PRESETS,
  effectiveTarget,
  allEpisodesReady,
  needsBatchEpisodes,
  episode1HasScript,
  batchAllTargetReady,
  batchActionLabel,
  batchButtonDisabled,
  episodesWithScript,
  activePreviewEpisode,
  previewScenes,
  saveDraft,
  runGenerateFirstEpisode,
  runBatchRemaining,
  runParse,
  onTargetEpisodeUpdate,
  selectPreviewEpisode,
  handleBack,
  reloadPage,
  onMounted: onMountedLogic
} = useGenerateEpisodes()

onMounted(async () => {
  await onMountedLogic()
})
</script>

<template>
  <div class="generate-page page-shell">
    <template v-if="projectId && !error">
      <GeneratePageToolbar :is-loading="isLoading" @back="handleBack" @save-draft="saveDraft" />

      <!-- Loading skeleton -->
      <template v-if="isLoading">
        <div class="loading-bar" role="status" aria-live="polite">
          <NSpin size="small" />
          <span>{{ generatingStatus || '正在加载项目…' }}</span>
        </div>
        <div class="two-col">
          <NCard title="故事创意">
            <NSkeleton text :repeat="6" />
          </NCard>
          <NCard title="故事梗概">
            <NSkeleton text :repeat="6" />
          </NCard>
        </div>
        <NCard class="mt" title="剧本预览">
          <NSkeleton text :repeat="8" />
        </NCard>
        <NCard class="mt" title="剧本生成">
          <NSkeleton height="34px" width="220px" round />
        </NCard>
        <NCard class="mt" title="选择视觉风格">
          <div class="style-list">
            <NSkeleton v-for="i in 4" :key="i" height="44px" width="96px" round />
          </div>
        </NCard>
        <div class="footer-actions mt">
          <NSkeleton height="34px" width="88px" round />
          <NSkeleton height="40px" width="120px" round />
        </div>
      </template>

      <!-- Main content -->
      <template v-else>
        <div class="two-col">
          <NCard title="故事创意">
            <NInput
              type="textarea"
              :rows="6"
              :value="(project as any)?.description || ''"
              placeholder="一句话描述你的故事"
              @update:value="(v) => ((project as any).description = v)"
            />
          </NCard>
          <NCard title="故事梗概">
            <NInput
              type="textarea"
              :rows="6"
              :value="(project as any)?.synopsis || ''"
              placeholder="梗概"
              @update:value="(v) => ((project as any).synopsis = v)"
            />
          </NCard>
        </div>

        <GenerateScriptPreview
          :episodes-with-script="episodesWithScript"
          :active-preview-episode="activePreviewEpisode"
          :preview-episode-num="previewEpisodeNum"
          :preview-scenes="previewScenes"
          :show-full-episode="showFullEpisode"
          :is-generating-first="isGeneratingFirst"
          :is-batching="isBatching"
          :is-parse-outline-running="isParseOutlineRunning"
          :needs-batch-episodes="needsBatchEpisodes"
          :all-episodes-ready="allEpisodesReady"
          :effective-target="effectiveTarget"
          @toggle-full="showFullEpisode = !showFullEpisode"
          @select-episode="selectPreviewEpisode"
          @generate-first="runGenerateFirstEpisode"
        />

        <GenerateEpisodeControl
          :target-episode-count="targetEpisodeCount"
          :effective-target="effectiveTarget"
          :min-target-episodes="MIN_TARGET_EPISODES"
          :max-target-episodes="MAX_TARGET_EPISODES"
          :episode-presets="EPISODE_PRESETS"
          :batch-button-disabled="batchButtonDisabled"
          :batch-action-label="batchActionLabel"
          :is-batching="isBatching"
          :batch-all-target-ready="batchAllTargetReady"
          :episode1-has-script="episode1HasScript"
          :is-parse-outline-running="isParseOutlineRunning"
          :is-generating-first="isGeneratingFirst"
          :episodes-with-script-count="episodesWithScript.length"
          :batch-progress-message="batchProgress?.progressMeta?.message ?? null"
          :needs-batch-episodes="needsBatchEpisodes"
          @update-target="onTargetEpisodeUpdate"
          @batch="runBatchRemaining"
        />

        <GenerateParseAction
          :is-parsing="isParsing"
          :is-parse-outline-running="isParseOutlineRunning"
          :is-batching="isBatching"
          :is-generating-first="isGeneratingFirst"
          :effective-target="effectiveTarget"
          @parse="runParse"
        />
      </template>
    </template>

    <NCard v-else-if="error" class="error-card">
      <NResult status="error" title="生成失败" :description="error">
        <template #footer>
          <NSpace>
            <NButton @click="handleBack">返回</NButton>
            <NButton type="primary" @click="reloadPage">重试</NButton>
          </NSpace>
        </template>
      </NResult>
    </NCard>
  </div>
</template>

<style scoped>
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

@media (max-width: 768px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

.mt {
  margin-top: var(--spacing-md);
}

.loading-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.error-card {
  max-width: 480px;
  margin: 100px auto;
}

.style-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}
</style>
