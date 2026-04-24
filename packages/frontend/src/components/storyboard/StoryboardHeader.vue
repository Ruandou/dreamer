<script setup lang="ts">
import { NButton, NSelect, NSwitch, NCheckbox, NDropdown } from 'naive-ui'

defineProps<{
  episodeOptions: Array<{ label: string; value: string }>
  currentEpisodeId: string | null
  selectedModel: 'wan2.6' | 'seedance2.0'
  isTrialMode: boolean
  selectedCount: number
  totalCount: number
  hasScenes: boolean
}>()

const emit = defineEmits<{
  back: []
  'update:episode': [id: string]
  'update:model': [model: 'wan2.6' | 'seedance2.0']
  'update:trialMode': [value: boolean]
  'update:selectAll': [checked: boolean]
  'batch-action': [key: string]
  'add-scene': []
}>()

const modelOptions = [
  { label: 'Wan 2.6 试错模式', value: 'wan2.6' },
  { label: 'Seedance 2.0 高光模式', value: 'seedance2.0' }
]

const batchOptions = [
  { label: '批量生成', key: 'generate' },
  { label: '批量删除', key: 'delete' }
]
</script>

<template>
  <header class="storyboard-header">
    <div class="storyboard-header__left">
      <NButton quaternary size="small" class="storyboard-back" @click="emit('back')">
        ← 返回分集管理
      </NButton>
      <h2 class="storyboard-header__title">分镜控制台</h2>
      <NSelect
        v-if="episodeOptions.length"
        :value="currentEpisodeId ?? undefined"
        :options="episodeOptions"
        placeholder="选择分集"
        filterable
        style="min-width: 200px; max-width: 280px"
        @update:value="(v: string) => emit('update:episode', v)"
      />
      <div class="mode-toggle">
        <NSwitch
          :value="isTrialMode"
          size="small"
          @update:value="(v) => emit('update:trialMode', v)"
        />
        <span class="mode-label">{{ isTrialMode ? '试错模式' : '高光模式' }}</span>
      </div>
    </div>
    <div class="storyboard-header__right">
      <NCheckbox
        v-if="hasScenes"
        :checked="selectedCount === totalCount && totalCount > 0"
        :indeterminate="selectedCount > 0 && selectedCount < totalCount"
        @update:checked="(checked) => emit('update:selectAll', checked)"
      >
        {{ selectedCount > 0 ? `已选 ${selectedCount}/${totalCount}` : '全选' }}
      </NCheckbox>

      <NSelect
        :value="selectedModel"
        :options="modelOptions"
        style="width: 180px"
        @update:value="(v: 'wan2.6' | 'seedance2.0') => emit('update:model', v)"
      />
      <NButton @click="emit('add-scene')">
        <template #icon>+</template>
        添加分镜
      </NButton>
      <NDropdown
        v-if="selectedCount > 0"
        trigger="click"
        :options="batchOptions"
        @select="(key) => emit('batch-action', key)"
      >
        <NButton type="primary"> 批量操作 ({{ selectedCount }}) </NButton>
      </NDropdown>
      <NButton
        v-else
        type="primary"
        :disabled="selectedCount === 0"
        @click="emit('batch-action', 'generate')"
      >
        批量生成
      </NButton>
    </div>
  </header>
</template>

<style scoped>
.storyboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.storyboard-header__left .storyboard-back {
  margin-right: 8px;
  flex-shrink: 0;
}
.storyboard-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.storyboard-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.mode-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.mode-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.storyboard-header__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
</style>
