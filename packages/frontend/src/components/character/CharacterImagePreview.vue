<script setup lang="ts">
import { NImage, NTag, NUpload, NButton, NSpace, NSpin, NPopconfirm } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import type { CharacterImage } from '@dreamer/shared/types'
import EmptyState from '@/components/EmptyState.vue'

defineProps<{
  selectedImage: CharacterImage | null
  promptDraft: string
  generating: boolean
  uploadingAvatar: boolean
  generateDisabled: boolean
  loosePrimary: { primaryName: string } | null
  canDelete: boolean
  parentName: string | undefined
  imageCost: number | null | undefined
}>()

const emit = defineEmits<{
  'update:promptDraft': [value: string]
  savePrompt: []
  queueGenerate: []
  avatarUpload: [options: { file: UploadFileInfo }]
  attachToPrimary: []
  deleteImage: [id: string]
}>()
</script>

<template>
  <div class="preview-panel">
    <div class="preview-panel__header">
      <h3>形象详情</h3>
      <NSpace v-if="selectedImage && (loosePrimary || canDelete)" :size="8" align="center" wrap>
        <NButton
          v-if="loosePrimary"
          size="tiny"
          quaternary
          :disabled="generating"
          @click="emit('attachToPrimary')"
        >
          关联到「{{ loosePrimary.primaryName }}」
        </NButton>
        <NPopconfirm
          v-if="canDelete"
          positive-text="删除"
          negative-text="取消"
          @positive-click="emit('deleteImage', selectedImage.id)"
        >
          <template #trigger>
            <NButton size="tiny" quaternary type="error" :disabled="generating"> 删除 </NButton>
          </template>
          确定删除形象「{{ selectedImage.name }}」？衍生节点将一并删除。
        </NPopconfirm>
      </NSpace>
    </div>
    <div class="preview-panel__body">
      <template v-if="selectedImage">
        <NSpin :show="generating" size="small" description="生成中…" class="preview-panel-spin">
          <div :key="selectedImage.id" class="preview-panel__selected">
            <div class="preview-image-wrap">
              <NImage
                v-if="selectedImage.avatarUrl"
                :src="selectedImage.avatarUrl"
                width="100%"
                height="400"
                object-fit="contain"
                preview
                class="preview-image"
              />
              <div v-else class="preview-image-placeholder">
                <span class="preview-image-placeholder__icon" aria-hidden="true">🖼</span>
                <p class="preview-image-placeholder__title">暂无定妆图</p>
                <p class="preview-image-placeholder__hint">
                  可先「本地上传」，或填写下方提示词后保存，再点「AI生成」
                </p>
                <NUpload
                  accept="image/jpeg,image/png,image/webp"
                  :max="1"
                  :show-file-list="false"
                  :disabled="uploadingAvatar || generating"
                  @change="emit('avatarUpload', $event)"
                >
                  <NButton size="small" :loading="uploadingAvatar" :disabled="generating">
                    本地上传
                  </NButton>
                </NUpload>
              </div>
              <div v-if="selectedImage.avatarUrl" class="preview-image-replace">
                <NUpload
                  accept="image/jpeg,image/png,image/webp"
                  :max="1"
                  :show-file-list="false"
                  :disabled="uploadingAvatar || generating"
                  @change="emit('avatarUpload', $event)"
                >
                  <NButton size="tiny" quaternary :loading="uploadingAvatar" :disabled="generating">
                    本地上传
                  </NButton>
                </NUpload>
              </div>
            </div>
            <div class="preview-info">
              <h4>{{ selectedImage.name }}</h4>
              <NTag
                :type="
                  selectedImage.type === 'base'
                    ? 'success'
                    : selectedImage.type === 'outfit'
                      ? 'info'
                      : selectedImage.type === 'expression'
                        ? 'warning'
                        : 'default'
                "
                size="small"
              >
                {{
                  selectedImage.type === 'base'
                    ? '基础'
                    : selectedImage.type === 'outfit'
                      ? '服装'
                      : selectedImage.type === 'expression'
                        ? '表情'
                        : '姿态'
                }}
              </NTag>
              <p v-if="imageCost != null && imageCost > 0" class="preview-cost muted">
                本图成本（估算）¥{{ imageCost.toFixed(4) }}
              </p>
              <p v-if="selectedImage.description" class="preview-desc">
                {{ selectedImage.description }}
              </p>
              <p v-if="selectedImage.parentId" class="preview-parent">衍生自: {{ parentName }}</p>
              <div class="prompt-block">
                <h5 class="prompt-block__title">文生图提示词（中文）</h5>
                <NInput
                  :value="promptDraft"
                  @update:value="emit('update:promptDraft', $event)"
                  type="textarea"
                  placeholder="解析或手动填写；保存后再生成"
                  :rows="4"
                  style="margin-top: 8px"
                />
                <NSpace style="margin-top: 8px" justify="end" wrap>
                  <NButton size="small" @click="emit('savePrompt')">保存</NButton>
                  <NUpload
                    accept="image/jpeg,image/png,image/webp"
                    :max="1"
                    :show-file-list="false"
                    :disabled="uploadingAvatar || generating"
                    @change="emit('avatarUpload', $event)"
                  >
                    <NButton size="small" :loading="uploadingAvatar" :disabled="generating">
                      本地上传
                    </NButton>
                  </NUpload>
                  <NButton
                    size="small"
                    type="primary"
                    :loading="generating"
                    :disabled="generateDisabled || uploadingAvatar"
                    @click="emit('queueGenerate')"
                  >
                    AI生成
                  </NButton>
                </NSpace>
              </div>
            </div>
          </div>
        </NSpin>
      </template>
      <EmptyState v-else title="选择形象" description="点击左侧树节点查看详情" icon="👈" />
    </div>
  </div>
</template>

<style scoped>
.preview-panel {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
}

.preview-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.preview-panel__header h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.preview-panel__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
}

.preview-panel-spin {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.preview-panel-spin :deep(.n-spin-content) {
  min-height: 0;
}

.preview-panel__selected {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
}

.preview-image-wrap {
  width: 100%;
  flex-shrink: 0;
}

.preview-image {
  display: block;
  border-radius: var(--radius-md);
  background: var(--color-bg-gray);
}

.preview-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  width: 100%;
  box-sizing: border-box;
  padding: var(--spacing-lg);
  text-align: center;
  background: var(--color-bg-gray);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
}

.preview-image-placeholder__icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: var(--spacing-sm);
  opacity: 0.85;
}

.preview-image-placeholder__title {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.preview-image-placeholder__hint {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  max-width: 280px;
}

.preview-image-replace {
  margin-top: var(--spacing-sm);
  text-align: center;
}

.preview-info {
  width: 100%;
  text-align: center;
  padding: var(--spacing-md) 0;
}

.preview-info h4 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm);
}

.preview-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-sm);
}

.preview-parent {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-xs);
}

.prompt-block {
  margin-top: var(--spacing-md);
  text-align: left;
  width: 100%;
}

.prompt-block__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text-secondary);
}
</style>
