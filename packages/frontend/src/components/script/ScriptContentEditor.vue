<script setup lang="ts">
import {
  NButton,
  NSpace,
  NInput,
  NSpin,
  NAlert,
  NCollapse,
  NCollapseItem,
  NTag,
  NTooltip,
  NScrollbar
} from 'naive-ui'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

interface Props {
  selectedEpisodeId: string | null
  isLoading: boolean
  script: Record<string, unknown> | null
  currentEpisodeTitle: string | null
  isAutoSaving: boolean
  lastSaved: Date | null
}

defineProps<Props>()

const emit = defineEmits<{
  'update:title': [value: string]
  save: []
  expand: []
}>()
</script>

<template>
  <main class="script-main">
    <!-- No Episode Selected -->
    <div v-if="!selectedEpisodeId" class="script-empty">
      <EmptyState title="选择一集开始" description="从左侧列表选择剧本，或新建一集" icon="📝" />
    </div>

    <!-- Loading -->
    <div v-else-if="isLoading" class="script-loading">
      <NSpin size="large" />
      <p>加载中...</p>
    </div>

    <!-- No Script Generated -->
    <div v-else-if="!script" class="script-empty">
      <EmptyState
        title="剧本尚未生成"
        description="使用 AI 扩写功能，基于故事梗概生成完整剧本"
        icon="✨"
      >
        <template #action>
          <NButton type="primary" @click="emit('expand')"> 使用 AI 生成剧本 </NButton>
        </template>
      </EmptyState>
    </div>

    <!-- Script Content -->
    <div v-else class="script-content">
      <!-- Script Header -->
      <div class="script-content__header">
        <div class="script-title-wrapper">
          <NInput
            :value="currentEpisodeTitle ?? ''"
            placeholder="输入剧本标题"
            size="large"
            class="script-title-input"
            @update:value="emit('update:title', $event)"
          />
          <StatusBadge :status="script ? 'completed' : 'draft'" />
          <span v-if="isAutoSaving" class="auto-save-hint">保存中...</span>
          <span v-else-if="lastSaved" class="auto-save-hint">已自动保存</span>
        </div>
        <NSpace>
          <NButton @click="emit('save')">保存修改</NButton>
        </NSpace>
      </div>

      <!-- Summary -->
      <NAlert v-if="(script as any).summary" type="info" class="script-summary">
        <template #icon>📖</template>
        {{ (script as any).summary }}
      </NAlert>

      <!-- Scenes -->
      <div class="scenes-section">
        <h3 class="scenes-section__title">
          <span>📼</span> 分镜场景 ({{ (script as any).scenes?.length || 0 }})
        </h3>

        <NScrollbar x-scrollable>
          <div class="scenes-list">
            <NCollapse>
              <NCollapseItem
                v-for="scene in (script as any).scenes"
                :key="scene.sceneNum"
                :name="scene.sceneNum"
              >
                <template #header>
                  <div class="scene-header">
                    <span class="scene-header__num">场景 {{ scene.sceneNum }}</span>
                    <span class="scene-header__location">{{ scene.location || '未命名' }}</span>
                  </div>
                </template>
                <template #header-extra>
                  <NTooltip>
                    <template #trigger>
                      <NTag
                        :type="scene.timeOfDay === '夜' ? 'warning' : 'info'"
                        size="small"
                        round
                      >
                        {{ scene.timeOfDay || '日' }}
                      </NTag>
                    </template>
                    时间：{{ scene.timeOfDay }}
                  </NTooltip>
                </template>

                <div class="scene-detail">
                  <!-- Characters -->
                  <div v-if="scene.characters?.length" class="scene-section">
                    <h4 class="scene-section__title">👥 角色</h4>
                    <NSpace>
                      <NTag v-for="char in scene.characters" :key="char" size="small">
                        {{ char }}
                      </NTag>
                    </NSpace>
                  </div>

                  <!-- Description -->
                  <div v-if="scene.description" class="scene-section">
                    <h4 class="scene-section__title">📝 场景描述</h4>
                    <p class="scene-description">{{ scene.description }}</p>
                  </div>

                  <!-- Dialogues -->
                  <div v-if="scene.dialogues?.length" class="scene-section">
                    <h4 class="scene-section__title">💬 对话</h4>
                    <div class="dialogues-list">
                      <div
                        v-for="(dialogue, idx) in scene.dialogues"
                        :key="idx"
                        class="dialogue-item"
                      >
                        <span class="dialogue-character">{{ dialogue.character }}</span>
                        <span class="dialogue-content">：{{ dialogue.content }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div v-if="scene.actions?.length" class="scene-section">
                    <h4 class="scene-section__title">🎬 动作</h4>
                    <ul class="actions-list">
                      <li v-for="(action, idx) in scene.actions" :key="idx">
                        {{ action }}
                      </li>
                    </ul>
                  </div>
                </div>
              </NCollapseItem>
            </NCollapse>
          </div>
        </NScrollbar>
      </div>
    </div>
  </main>
</template>

<style scoped>
.script-main {
  flex: 1;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.script-empty,
.script-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.script-loading p {
  margin-top: var(--spacing-md);
  color: var(--color-text-secondary);
}

.script-content {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.script-content__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-md);
}

.script-title-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.script-title-input {
  flex: 1;
}

.script-title-input :deep(.n-input__input-el) {
  font-size: var(--font-size-xl) !important;
  font-weight: var(--font-weight-semibold);
}

.script-summary {
  margin-bottom: var(--spacing-lg);
}

.scenes-section {
  margin-top: var(--spacing-lg);
}

.scenes-section__title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
}

.scenes-list {
  min-width: 600px;
}

.scene-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.scene-header__num {
  font-weight: var(--font-weight-semibold);
}

.scene-header__location {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.scene-detail {
  padding: var(--spacing-sm) 0;
}

.scene-section {
  margin-bottom: var(--spacing-md);
}

.scene-section__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.scene-description {
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  background: var(--color-bg-gray);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

.dialogues-list {
  background: var(--color-bg-gray);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

.dialogue-item {
  margin-bottom: var(--spacing-sm);
  line-height: var(--line-height-relaxed);
}

.dialogue-item:last-child {
  margin-bottom: 0;
}

.dialogue-character {
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.dialogue-content {
  color: var(--color-text-primary);
}

.actions-list {
  background: var(--color-bg-gray);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin: 0;
}

.actions-list li {
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}

.actions-list li:last-child {
  margin-bottom: 0;
}

.auto-save-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
</style>
