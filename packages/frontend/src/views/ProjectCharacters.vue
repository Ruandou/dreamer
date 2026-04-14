<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NImage,
  NUpload,
  NPopconfirm,
  NTag,
  NAvatar,
  useMessage,
  NDropdown,
  NSpin,
  NEmpty
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import EmptyState from '@/components/EmptyState.vue'
import type { Character, CharacterImage } from '@dreamer/shared/types'
import { subscribeProjectUpdates } from '@/lib/project-sse-bridge'
import { getDisplayBaseImages, getDisplayDerivedImages } from '@/lib/character-image-groups'
import { fetchInFlightImageJobsForProject } from '@/lib/pending-image-jobs'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const characterStore = useCharacterStore()

const projectId = computed(() => route.params.id as string)

const searchQuery = ref('')

const filteredCharacters = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = characterStore.characters
  if (!q) return list
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
  )
})

function imageStats(character: Character) {
  const images = character.images || []
  const bases = getDisplayBaseImages(images)
  let derived = 0
  for (const b of bases) {
    derived += getDisplayDerivedImages(images, b.id).length
  }
  return { base: bases.length, derived, total: images.length }
}

function formatImageStatsLine(character: Character): string {
  const s = imageStats(character)
  if (s.total === 0) return ''
  return s.derived > 0 ? `${s.base} 定妆 · ${s.derived} 衍生` : `${s.base} 定妆`
}

watch(projectId, async (id) => {
  if (!id) return
  searchQuery.value = ''
  await characterStore.fetchCharacters(id)
  await hydrateGeneratingFromQueue()
})

const showCreateModal = ref(false)
const showImageModal = ref(false)
const newCharacter = ref({ name: '', description: '' })
const imageForm = ref({
  name: '',
  type: 'base',
  parentId: undefined as string | undefined,
  description: ''
})
const currentCharacterId = ref<string | null>(null)
const selectedImageId = ref<string | null>(null)
/** 已提交、等待 Worker 完成的形象图任务 */
const generatingByImageId = ref<Record<string, boolean>>({})
/** 尚无形象行、仅「新建定妆/衍生」队列任务可绑定的角色级 loading（与 Bull 任务 binding 一一对应） */
const generatingCharacterPendingCreate = ref<Record<string, boolean>>({})

let unsubProjectSse: (() => void) | null = null

async function hydrateGeneratingFromQueue() {
  try {
    const { characterImageIds, characterIdsWithPendingNewImage } =
      await fetchInFlightImageJobsForProject(projectId.value)
    const next = { ...generatingByImageId.value }
    for (const id of characterImageIds) {
      next[id] = true
    }
    generatingByImageId.value = next
    const nextCh: Record<string, boolean> = {}
    for (const cid of characterIdsWithPendingNewImage) {
      nextCh[cid] = true
    }
    generatingCharacterPendingCreate.value = nextCh
  } catch {
    // 忽略拉取失败
  }
}

onMounted(async () => {
  await characterStore.fetchCharacters(projectId.value)
  await hydrateGeneratingFromQueue()
  unsubProjectSse = subscribeProjectUpdates(projectId.value, (p) => {
    if (p.type !== 'image-generation') return
    const imgId = typeof p.characterImageId === 'string' ? p.characterImageId : undefined
    const k = typeof p.kind === 'string' ? p.kind : ''
    if (
      (p.status === 'completed' || p.status === 'failed') &&
      (k === 'character_base_create' || k === 'character_derived_create') &&
      typeof p.characterId === 'string'
    ) {
      const nextC = { ...generatingCharacterPendingCreate.value }
      delete nextC[p.characterId as string]
      generatingCharacterPendingCreate.value = nextC
    }
    if (imgId && (p.status === 'completed' || p.status === 'failed')) {
      const next = { ...generatingByImageId.value }
      delete next[imgId]
      generatingByImageId.value = next
    }
    if (p.status === 'completed' && p.characterImageId) {
      void characterStore.fetchCharacters(projectId.value)
      message.success('形象图已更新')
    }
    if (p.status === 'failed' && p.kind?.startsWith('character')) {
      message.error((p.error as string) || '形象生成失败')
    }
  })
})

onUnmounted(() => {
  unsubProjectSse?.()
  unsubProjectSse = null
})

const handleCreateCharacter = async () => {
  if (!newCharacter.value.name.trim()) {
    message.warning('请输入角色名称')
    return
  }
  await characterStore.createCharacter({
    projectId: projectId.value,
    name: newCharacter.value.name,
    description: newCharacter.value.description
  })
  showCreateModal.value = false
  newCharacter.value = { name: '', description: '' }
  message.success('角色创建成功')
}

const handleDeleteCharacter = async (id: string) => {
  await characterStore.deleteCharacter(id)
  message.success('角色已删除')
}

const openImageModal = (characterId: string, parentId?: string) => {
  currentCharacterId.value = characterId
  imageForm.value = {
    name: '',
    type: parentId ? 'outfit' : 'base',
    parentId,
    description: ''
  }
  showImageModal.value = true
}

const handleImageUpload = async (options: { file: UploadFileInfo }) => {
  if (!currentCharacterId.value || !imageForm.value.name) {
    message.warning('请输入形象名称')
    return
  }
  const file = options.file.file
  if (file) {
    await characterStore.addImage(
      currentCharacterId.value,
      file,
      imageForm.value.name,
      imageForm.value.parentId,
      imageForm.value.type,
      imageForm.value.description
    )
    showImageModal.value = false
    imageForm.value = { name: '', type: 'base', parentId: undefined, description: '' }
    message.success('形象添加成功')
  }
}

const handleDeleteImage = async (characterId: string, imageId: string) => {
  await characterStore.deleteImage(characterId, imageId)
  message.success('形象已删除')
}

const handleMoveImage = async (characterId: string, imageId: string, newParentId?: string) => {
  await characterStore.moveImage(characterId, imageId, newParentId)
  message.success('形象已移动')
}

const getCharacterInitials = (name: string) => {
  return name.charAt(0).toUpperCase()
}

const getAvatarBgColor = (name: string) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    base: '基础',
    outfit: '服装',
    expression: '表情',
    pose: '姿态'
  }
  return map[type] || type
}

const imageActionOptions = (_characterId: string, imageId: string, images: CharacterImage[]) => {
  const image = images.find((i) => i.id === imageId)
  const options: { label: string; key: string }[] = []
  const bases = getDisplayBaseImages(images)
  const primary = bases[0]
  const looseUnderPrimary = Boolean(
    image &&
      !image.parentId &&
      image.type !== 'base' &&
      primary?.type === 'base' &&
      primary.id
  )

  if (image) {
    if (image.type === 'base' && !image.parentId) {
      options.push({ label: image.avatarUrl ? 'AI 重新生成' : 'AI 生成定妆', key: 'ai-generate' })
    } else {
      const parentId = image.parentId || (looseUnderPrimary ? primary!.id : undefined)
      const parent = parentId ? images.find((i) => i.id === parentId) : undefined
      if (parent?.avatarUrl) {
        options.push({ label: image.avatarUrl ? 'AI 重新生成' : 'AI 生成', key: 'ai-generate' })
      }
    }
  }

  options.push({ label: '添加子形象', key: 'add-child' })
  if (looseUnderPrimary && primary) {
    options.push({ label: `关联到「${primary.name}」`, key: 'attach-primary' })
  }
  if (image?.parentId) {
    options.push({ label: '设为独立形象', key: 'detach' })
  }
  options.push({ label: '删除', key: 'delete' })

  return options
}

async function queueGenerate(_characterId: string, imageId: string) {
  generatingByImageId.value = { ...generatingByImageId.value, [imageId]: true }
  try {
    await characterStore.queueCharacterImageGenerate(imageId)
    message.info('已提交生成，请稍候…')
  } catch (e: any) {
    const next = { ...generatingByImageId.value }
    delete next[imageId]
    generatingByImageId.value = next
    message.error(e?.response?.data?.error || '提交失败')
  }
}

const handleImageAction = (key: string, characterId: string, imageId: string, images: CharacterImage[]) => {
  switch (key) {
    case 'ai-generate':
      void queueGenerate(characterId, imageId)
      break
    case 'add-child':
      openImageModal(characterId, imageId)
      break
    case 'attach-primary': {
      const primary = getDisplayBaseImages(images)[0]
      if (primary) void handleMoveImage(characterId, imageId, primary.id)
      break
    }
    case 'delete':
      handleDeleteImage(characterId, imageId)
      break
    case 'detach':
      handleMoveImage(characterId, imageId, undefined)
      break
  }
}

async function confirmImageModalByAi() {
  if (!currentCharacterId.value || !imageForm.value.name.trim()) {
    message.warning('请输入形象名称')
    return
  }
  try {
    await characterStore.addImageSlotByAi(currentCharacterId.value, {
      name: imageForm.value.name.trim(),
      type: imageForm.value.type,
      parentId: imageForm.value.parentId,
      description: imageForm.value.description?.trim() || undefined
    })
    showImageModal.value = false
    imageForm.value = { name: '', type: 'base', parentId: undefined, description: '' }
    message.success('已创建槽位，可在菜单中选「AI 生成」')
  } catch (e: any) {
    message.error(e?.response?.data?.error || '创建失败')
  }
}

</script>

<template>
  <div class="characters-page">
    <div class="characters-toolbar">
      <p class="characters-toolbar__hint">
        定妆与衍生形象一览；点卡片下方进入详情可管理形象树与提示词。
      </p>
      <div class="characters-toolbar__row">
        <NInput
          v-model:value="searchQuery"
          clearable
          round
          placeholder="搜索角色名称或描述…"
          class="characters-toolbar__search"
        >
          <template #prefix>
            <span class="characters-toolbar__search-icon" aria-hidden="true">⌕</span>
          </template>
        </NInput>
        <div class="characters-toolbar__actions">
          <span
            v-if="characterStore.characters.length"
            class="characters-toolbar__meta"
          >
            共 {{ characterStore.characters.length }} 个角色
            <template v-if="searchQuery.trim() && filteredCharacters.length !== characterStore.characters.length">
              · 显示 {{ filteredCharacters.length }} 个
            </template>
          </span>
          <NButton type="primary" @click="showCreateModal = true">
            <template #icon>+</template>
            添加角色
          </NButton>
        </div>
      </div>
    </div>

    <div class="characters-content">
      <NSpin
        :show="characterStore.isLoading && characterStore.characters.length === 0"
        class="characters-loading"
        description="加载角色列表…"
      >
        <div class="characters-body">
          <EmptyState
            v-if="!characterStore.isLoading && characterStore.characters.length === 0"
            title="暂无角色"
            description="创建角色，定义人物外貌、性格和特点"
            icon="👥"
          >
            <template #action>
              <NButton type="primary" size="large" @click="showCreateModal = true">
                添加第一个角色
              </NButton>
            </template>
          </EmptyState>

          <NEmpty
            v-else-if="
              characterStore.characters.length > 0 && filteredCharacters.length === 0
            "
            description="没有匹配的角色"
            class="characters-search-empty"
          >
            <template #extra>
              <NButton size="small" @click="searchQuery = ''">清空搜索</NButton>
            </template>
          </NEmpty>

          <div
            v-else-if="characterStore.characters.length > 0"
            class="characters-grid"
          >
        <NCard
          v-for="character in filteredCharacters"
          :key="character.id"
          class="character-card"
          :class="{ 'character-card--pending-new-image': generatingCharacterPendingCreate[character.id] }"
          hoverable
          :segmented="{ content: true, footer: 'soft' }"
        >
          <!-- Avatar Section - Base Images -->
          <div class="character-card__avatar">
            <div v-if="getDisplayBaseImages(character.images || []).length === 0" class="avatar-placeholder-container">
              <div
                class="character-avatar-placeholder"
                :style="{ background: getAvatarBgColor(character.name) }"
              >
                <NAvatar :size="64" round>
                  {{ getCharacterInitials(character.name) }}
                </NAvatar>
              </div>
              <NButton
                size="small"
                class="add-base-image-btn"
                @click.stop="openImageModal(character.id)"
              >
                添加基础形象
              </NButton>
            </div>
            <div v-else class="base-images-grid">
              <div
                v-for="baseImage in getDisplayBaseImages(character.images || [])"
                :key="baseImage.id"
                class="base-image-cluster"
              >
                <div
                  class="base-image-item"
                  :class="{
                    'base-image-item--selected': selectedImageId === baseImage.id,
                    'base-image-item--generating': generatingByImageId[baseImage.id]
                  }"
                  @click="selectedImageId = baseImage.id"
                >
                  <NImage
                    v-if="baseImage.avatarUrl"
                    :src="baseImage.avatarUrl"
                    width="100%"
                    height="140"
                    object-fit="cover"
                    preview
                  />
                  <div class="base-image-info">
                    <span class="base-image-name">{{ baseImage.name }}</span>
                    <NDropdown
                      trigger="click"
                      :options="imageActionOptions(character.id, baseImage.id, character.images || [])"
                      @select="(key) => handleImageAction(key, character.id, baseImage.id, character.images || [])"
                    >
                      <NButton size="tiny" quaternary @click.stop>⋯</NButton>
                    </NDropdown>
                  </div>
                </div>
                <div
                  v-if="getDisplayDerivedImages(character.images || [], baseImage.id).length > 0"
                  class="derived-images"
                >
                  <NDropdown
                    v-for="derived in getDisplayDerivedImages(character.images || [], baseImage.id)"
                    :key="derived.id"
                    trigger="click"
                    :options="imageActionOptions(character.id, derived.id, character.images || [])"
                    @select="(key) => handleImageAction(key, character.id, derived.id, character.images || [])"
                  >
                    <div
                      class="derived-image-thumb"
                      :class="{ 'derived-image-thumb--busy': generatingByImageId[derived.id] }"
                      @click.stop="selectedImageId = derived.id"
                    >
                      <NImage
                        v-if="derived.avatarUrl"
                        :src="derived.avatarUrl"
                        width="32"
                        height="32"
                        object-fit="cover"
                      />
                      <span
                        v-else
                        class="derived-placeholder"
                        :title="`${derived.name}（${getTypeLabel(derived.type)}）打开菜单可 AI 生成`"
                      >+</span>
                    </div>
                  </NDropdown>
                </div>
              </div>
              <div class="add-base-image-cell" @click="openImageModal(character.id)">
                <span>+ 添加形象</span>
              </div>
            </div>
          </div>

          <!-- Info Section -->
          <div class="character-card__info">
            <div class="character-card__title-row">
              <h3 class="character-card__name">{{ character.name }}</h3>
              <NTag
                v-if="imageStats(character).total > 0"
                size="small"
                round
                :bordered="false"
              >
                {{ formatImageStatsLine(character) }}
              </NTag>
              <NTag v-else size="small" round :bordered="false" type="warning">
                待添加形象
              </NTag>
            </div>
            <p class="character-card__desc">
              {{ character.description || '暂无描述' }}
            </p>
          </div>

          <template #footer>
            <div class="character-card__actions">
              <NSpace justify="space-between" class="character-card__actions-inner">
                <NButton
                  type="primary"
                  size="small"
                  secondary
                  @click="router.push(`/project/${projectId}/characters/${character.id}`)"
                >
                  详情与形象树
                </NButton>
                <NPopconfirm @positive-click="handleDeleteCharacter(character.id)">
                  <template #trigger>
                    <NButton size="small" type="error" quaternary>
                      删除
                    </NButton>
                  </template>
                  确认删除角色「{{ character.name }}」？
                </NPopconfirm>
              </NSpace>
            </div>
          </template>
        </NCard>
          </div>
        </div>
      </NSpin>
    </div>

    <!-- Create Character Modal -->
    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="添加角色"
      style="width: 480px"
    >
      <NForm :model="newCharacter" label-placement="top">
        <NFormItem label="角色名称" path="name">
          <NInput
            v-model:value="newCharacter.name"
            placeholder="输入角色名称"
          />
        </NFormItem>
        <NFormItem label="角色描述" path="description">
          <NInput
            v-model:value="newCharacter.description"
            type="textarea"
            placeholder="描述角色的外貌、性格、背景等..."
            :rows="4"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateCharacter">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Add Image Modal -->
    <NModal
      v-model:show="showImageModal"
      preset="card"
      :title="imageForm.parentId ? '添加衍生形象' : '添加基础形象'"
      style="width: 480px"
    >
      <NForm :model="imageForm" label-placement="top">
        <NFormItem label="形象名称" path="name">
          <NInput v-model:value="imageForm.name" placeholder="如：日常装、战斗版、微笑表情" />
        </NFormItem>
        <NFormItem label="类型" path="type">
          <NSpace>
            <NTag
              :type="imageForm.type === 'base' ? 'success' : 'default'"
              :bordered="imageForm.type !== 'base'"
              checkable
              @click="imageForm.type = 'base'"
            >基础</NTag>
            <NTag
              :type="imageForm.type === 'outfit' ? 'info' : 'default'"
              :bordered="imageForm.type !== 'outfit'"
              checkable
              @click="imageForm.type = 'outfit'"
            >服装</NTag>
            <NTag
              :type="imageForm.type === 'expression' ? 'warning' : 'default'"
              :bordered="imageForm.type !== 'expression'"
              checkable
              @click="imageForm.type = 'expression'"
            >表情</NTag>
            <NTag
              :type="imageForm.type === 'pose' ? 'default' : 'default'"
              :bordered="imageForm.type !== 'pose'"
              checkable
              @click="imageForm.type = 'pose'"
            >姿态</NTag>
          </NSpace>
        </NFormItem>
        <NFormItem v-if="imageForm.parentId" label="衍生形象说明" path="description">
          <NInput
            v-model:value="imageForm.description"
            type="textarea"
            placeholder="描述该衍生形象的特点..."
            :rows="2"
          />
        </NFormItem>
        <NFormItem label="参考图" path="file">
          <NUpload
            accept="image/*"
            :max="1"
            @change="(options: any) => handleImageUpload(options)"
          >
            <NButton>选择图片</NButton>
          </NUpload>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showImageModal = false">取消</NButton>
          <NButton secondary @click="confirmImageModalByAi">不上传图，AI 建槽位</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.characters-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.characters-toolbar {
  margin-bottom: var(--spacing-md);
  flex-shrink: 0;
}

.characters-toolbar__hint {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.characters-toolbar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
}

.characters-toolbar__search {
  flex: 1 1 200px;
  min-width: 0;
  max-width: 420px;
}

.characters-toolbar__search-icon {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.characters-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  margin-left: auto;
}

.characters-toolbar__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.characters-content {
  flex: 1;
  min-height: 0;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border-light);
}

.characters-loading {
  min-height: 280px;
}

.characters-loading :deep(.n-spin-body) {
  min-height: 240px;
}

.characters-body {
  min-height: 200px;
}

.characters-search-empty {
  padding: var(--spacing-xl) 0;
}

.character-card--pending-new-image {
  outline: 2px solid var(--color-primary);
  outline-offset: 0;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.character-card {
  overflow: hidden;
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
  border: 1px solid var(--color-border-light);
}

.character-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.character-card :deep(.n-card__content) {
  padding-top: var(--spacing-sm);
}

.character-card__avatar {
  margin: calc(var(--spacing-md) * -1);
  margin-bottom: var(--spacing-md);
  min-height: 160px;
  background: var(--color-bg-gray);
}

.avatar-placeholder-container {
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.character-avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 32px;
  font-weight: var(--font-weight-bold);
}

.add-base-image-btn {
  opacity: 0.8;
}

.base-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
}

.base-image-cluster {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-white);
}

.base-image-item {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.base-image-item:hover {
  transform: scale(1.02);
  box-shadow: var(--shadow-md);
}

.base-image-item--selected {
  outline: 2px solid var(--color-primary);
}

.base-image-item--generating {
  opacity: 0.75;
  pointer-events: none;
}

.base-image-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: white;
}

.base-image-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.derived-images {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px;
  background: var(--color-bg-gray);
  border-top: 1px solid var(--color-border-light);
}

.derived-image-thumb {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.derived-image-thumb:hover {
  opacity: 1;
}

.derived-image-thumb--busy {
  opacity: 0.5;
  pointer-events: none;
}

.derived-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 14px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-soft);
  border-radius: 4px;
}

.add-base-image-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: var(--font-size-sm);
}

.add-base-image-cell:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.character-card__info {
  margin-bottom: 0;
}

.character-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.character-card__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
}

.character-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.character-card__actions {
  padding: 0;
}

.character-card__actions-inner {
  width: 100%;
}
</style>
