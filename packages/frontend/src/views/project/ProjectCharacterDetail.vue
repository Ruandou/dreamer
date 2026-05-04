<script setup lang="ts">
import { toRefs } from 'vue'
import { useDialog, NBackTop, NSpin, NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useCharacterDetail } from '@/composables/useCharacterDetail'
import { useCharacterStore } from '@/stores/character'
import EmptyState from '@/components/EmptyState.vue'
import CharacterDetailHeader from '@/components/character/CharacterDetailHeader.vue'
import CharacterRail from '@/components/character/CharacterRail.vue'
import CharacterImageTree from '@/components/character/CharacterImageTree.vue'
import CharacterImagePreview from '@/components/character/CharacterImagePreview.vue'
import AddImageModal from '@/components/character/AddImageModal.vue'

const router = useRouter()
const dialog = useDialog()
const characterStore = useCharacterStore()

const cd = useCharacterDetail()
const refs = toRefs(cd)

function handleBack() {
  router.push(`/project/${cd.projectId.value}/characters`)
}

async function switchProjectCharacter(targetId: string) {
  if (targetId === cd.characterId.value) return
  const ok = await cd.savePromptDraftIfDirty(true)
  if (!ok) return
  await router.push(`/project/${cd.projectId.value}/characters/${targetId}`)
}

function batchGenerateThisCharacter() {
  dialog.warning({
    title: '确认 AI 一键生成',
    content:
      '将为当前角色下所有可生成的形象槽位入队（需已填提示词且未出图；衍生需父级已出图）。是否继续？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      void executeBatchGenerateThisCharacter()
    }
  })
}

async function executeBatchGenerateThisCharacter() {
  const ok = await cd.savePromptDraftIfDirty(true)
  if (!ok) return
  cd.batchGeneratingCharacter.value = true
  try {
    const data = await characterStore.batchGenerateMissingCharacterAvatars(cd.projectId.value, {
      characterId: cd.characterId.value
    })
    const { enqueued, skipped } = data
    if (enqueued > 0) {
      cd.message.success(`已入队 ${enqueued} 个定妆生成任务`)
      void cd.hydrateGeneratingFromQueue()
    } else {
      cd.message.warning('没有可生成的槽位（需提示词且无定妆图，衍生需父级已出图）')
    }
    if (skipped.length > 0) {
      const reasons = [...new Set(skipped.map((s) => s.reason))]
      cd.message.info(`已跳过 ${skipped.length} 个：${reasons.join('；')}`)
    }
  } catch (e: any) {
    cd.message.error(e?.response?.data?.error || '批量入队失败')
  } finally {
    cd.batchGeneratingCharacter.value = false
  }
}
</script>

<template>
  <div class="character-detail-page">
    <!-- Header -->
    <CharacterDetailHeader
      :character="refs.character.value"
      :has-root-base="refs.characterHasRootBase.value"
      @back="handleBack"
      @add-image="cd.openAddModal()"
    />

    <!-- Loading -->
    <div v-if="refs.isLoading.value" class="detail-loading">
      <NSpin size="large" />
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="!refs.character.value || refs.treeData.value.length === 0"
      title="暂无形象"
      description="每角色仅一个基础定妆；添加后可在此管理衍生形象与提示词"
      icon="🎭"
    >
      <template #action>
        <NButton type="primary" size="large" @click="cd.openAddModal()"> 添加第一个形象 </NButton>
      </template>
    </EmptyState>

    <!-- Content -->
    <div
      v-else
      class="detail-content"
      :class="{ 'detail-content--with-rail': refs.showCharacterRail.value }"
    >
      <!-- Character Rail -->
      <CharacterRail
        v-if="refs.showCharacterRail.value"
        :characters="refs.projectCharactersInListOrder.value"
        :active-character-id="refs.characterId.value"
        @switch-character="switchProjectCharacter"
      />

      <!-- Tree View -->
      <CharacterImageTree
        :tree-data="refs.treeData.value"
        :selected-image-id="refs.selectedImageId.value"
        :multiple-root-bases="refs.multipleRootBases.value"
        :batch-generating="refs.batchGeneratingCharacter.value"
        :character-exists="!!refs.character.value"
        @select-keys="cd.onTreeSelectedKeys($event)"
        @batch-generate="batchGenerateThisCharacter"
        @drop="cd.handleDrop($event)"
      />

      <!-- Preview Panel -->
      <CharacterImagePreview
        :selected-image="refs.selectedImage.value"
        :prompt-draft="refs.promptDraft.value"
        :generating="!!refs.generatingByImageId.value[refs.selectedImage.value?.id ?? '']"
        :uploading-avatar="refs.uploadingAvatar.value"
        :generate-disabled="refs.selectedImageGenerateDisabled.value"
        :loose-primary="refs.selectedImageLoosePrimary.value"
        :can-delete="refs.selectedImageCanDelete.value"
        :parent-name="refs.selectedImageParentName.value"
        :image-cost="refs.selectedImage.value?.imageCost"
        @update:prompt-draft="refs.promptDraft.value = $event"
        @save-prompt="cd.savePromptDraft()"
        @queue-generate="cd.queueSelectedGenerate()"
        @avatar-upload="cd.handleAvatarUpload($event)"
        @attach-to-primary="cd.handleAttachToPrimary()"
        @delete-image="cd.handleDeleteImage($event)"
      />
    </div>

    <!-- Add Image Modal -->
    <AddImageModal
      :show="refs.showAddModal.value"
      :form="refs.addForm.value"
      :selected-file-name="refs.selectedFile.value?.name ?? null"
      :is-uploading="refs.isUploading.value"
      :add-by-ai-loading="refs.addByAiLoading.value"
      @update:show="refs.showAddModal.value = $event"
      @update:form="refs.addForm.value = $event"
      @file-change="cd.handleFileChange($event)"
      @confirm-add="cd.confirmAddImage()"
      @confirm-add-by-ai="cd.confirmAddImageByAi()"
    />

    <NBackTop :right="20" :bottom="20" />
  </div>
</template>

<style scoped>
.character-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-content {
  flex: 1;
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: var(--spacing-lg);
  min-height: 0;
}

.detail-content--with-rail {
  grid-template-columns: 172px minmax(260px, 360px) minmax(0, 1fr);
  gap: var(--spacing-md);
}
</style>
