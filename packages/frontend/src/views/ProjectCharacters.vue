<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput,
  NGrid, NGi, NImage, NImageGroup, NUpload, NPopconfirm, NTag, NTooltip,
  NAvatar, NScrollbar, useMessage, NIcon, NTree, NButtonGroup, NDropdown
} from 'naive-ui'
import type { UploadFile, TreeOption } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import EmptyState from '@/components/EmptyState.vue'
import type { Character, CharacterImage } from '@shared/types'

const route = useRoute()
const message = useMessage()
const characterStore = useCharacterStore()

const projectId = computed(() => route.params.id as string)

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showImageModal = ref(false)
const newCharacter = ref({ name: '', description: '' })
const editCharacter = ref<Character | null>(null)
const imageForm = ref({
  name: '',
  type: 'base',
  parentId: undefined as string | undefined,
  description: ''
})
const currentCharacterId = ref<string | null>(null)
const expandedCharacterIds = ref<string[]>([])
const selectedImageId = ref<string | null>(null)

onMounted(async () => {
  await characterStore.fetchCharacters(projectId.value)
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

const handleEditCharacter = (character: Character) => {
  editCharacter.value = { ...character }
  showEditModal.value = true
}

const handleSaveEdit = async () => {
  if (!editCharacter.value) return
  await characterStore.updateCharacter(editCharacter.value.id, {
    name: editCharacter.value.name,
    description: editCharacter.value.description
  })
  showEditModal.value = false
  message.success('角色更新成功')
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

const handleImageUpload = async (options: { file: UploadFile }) => {
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

const buildImageTree = (images: CharacterImage[]): TreeOption[] => {
  const imageMap = new Map<string, TreeOption>()
  const roots: TreeOption[] = []

  // First pass: create all nodes
  images.forEach(img => {
    imageMap.set(img.id, {
      key: img.id,
      label: img.name,
      data: img,
      children: []
    })
  })

  // Second pass: build tree
  images.forEach(img => {
    const node = imageMap.get(img.id)!
    if (img.parentId) {
      const parent = imageMap.get(img.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}

const getBaseImages = (images: CharacterImage[]) => {
  return images.filter(img => !img.parentId)
}

const getDerivedImages = (images: CharacterImage[], parentId: string) => {
  return images.filter(img => img.parentId === parentId)
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

const getTypeTagType = (type: string): 'default' | 'info' | 'success' | 'warning' => {
  const map: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
    base: 'success',
    outfit: 'info',
    expression: 'warning',
    pose: 'default'
  }
  return map[type] || 'default'
}

const imageActionOptions = (characterId: string, imageId: string, images: CharacterImage[]) => {
  const options = [
    { label: '添加子形象', key: 'add-child' },
    { label: '删除', key: 'delete' }
  ]

  // If has children, offer "移出树"
  const image = images.find(i => i.id === imageId)
  if (image?.parentId) {
    options.unshift({ label: '设为独立形象', key: 'detach' })
  }

  return options
}

const handleImageAction = (key: string, characterId: string, imageId: string, images: CharacterImage[]) => {
  switch (key) {
    case 'add-child':
      openImageModal(characterId, imageId)
      break
    case 'delete':
      handleDeleteImage(characterId, imageId)
      break
    case 'detach':
      handleMoveImage(characterId, imageId, undefined)
      break
  }
}

const toggleCharacterExpand = (characterId: string) => {
  const idx = expandedCharacterIds.value.indexOf(characterId)
  if (idx >= 0) {
    expandedCharacterIds.value.splice(idx, 1)
  } else {
    expandedCharacterIds.value.push(characterId)
  }
}

const isCharacterExpanded = (characterId: string) => {
  return expandedCharacterIds.value.includes(characterId)
}
</script>

<template>
  <div class="characters-page">
    <!-- Header -->
    <header class="characters-header">
      <div class="characters-header__left">
        <h2 class="characters-header__title">角色库</h2>
        <span class="characters-header__count" v-if="characterStore.characters.length">
          {{ characterStore.characters.length }} 个角色
        </span>
      </div>
      <div class="characters-header__right">
        <NButton type="primary" @click="showCreateModal = true">
          <template #icon>+</template>
          添加角色
        </NButton>
      </div>
    </header>

    <!-- Content -->
    <div class="characters-content">
      <!-- Empty State -->
      <EmptyState
        v-if="characterStore.characters.length === 0"
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

      <!-- Characters Grid -->
      <div v-else class="characters-grid">
        <NCard
          v-for="character in characterStore.characters"
          :key="character.id"
          class="character-card"
          hoverable
        >
          <!-- Avatar Section - Base Images -->
          <div class="character-card__avatar">
            <div v-if="getBaseImages(character.images || []).length === 0" class="avatar-placeholder-container">
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
                v-for="baseImage in getBaseImages(character.images || [])"
                :key="baseImage.id"
                class="base-image-item"
                :class="{ 'base-image-item--selected': selectedImageId === baseImage.id }"
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
                <div class="derived-images" v-if="getDerivedImages(character.images || [], baseImage.id).length > 0">
                  <NTooltip
                    v-for="derived in getDerivedImages(character.images || [], baseImage.id)"
                    :key="derived.id"
                  >
                    <template #trigger>
                      <div class="derived-image-thumb" @click.stop="selectedImageId = derived.id">
                        <NImage
                          v-if="derived.avatarUrl"
                          :src="derived.avatarUrl"
                          width="32"
                          height="32"
                          object-fit="cover"
                        />
                      </div>
                    </template>
                    <div>{{ derived.name }} ({{ getTypeLabel(derived.type) }})</div>
                  </NTooltip>
                </div>
              </div>
              <div class="add-base-image-cell" @click="openImageModal(character.id)">
                <span>+ 添加形象</span>
              </div>
            </div>
          </div>

          <!-- Info Section -->
          <div class="character-card__info">
            <h3 class="character-card__name">{{ character.name }}</h3>
            <p class="character-card__desc">
              {{ character.description || '暂无描述' }}
            </p>
          </div>

          <!-- Actions -->
          <div class="character-card__actions">
            <NSpace>
              <NButton size="small" @click="handleEditCharacter(character)">
                编辑
              </NButton>
              <NPopconfirm
                @positive-click="handleDeleteCharacter(character.id)"
              >
                <template #trigger>
                  <NButton size="small" type="error" text>
                    删除
                  </NButton>
                </template>
                确认删除角色「{{ character.name }}」？
              </NPopconfirm>
            </NSpace>
          </div>
        </NCard>
      </div>
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

    <!-- Edit Character Modal -->
    <NModal
      v-model:show="showEditModal"
      preset="card"
      title="编辑角色"
      style="width: 480px"
    >
      <NForm v-if="editCharacter" :model="editCharacter" label-placement="top">
        <NFormItem label="角色名称" path="name">
          <NInput v-model:value="editCharacter.name" placeholder="输入角色名称" />
        </NFormItem>
        <NFormItem label="角色描述" path="description">
          <NInput
            v-model:value="editCharacter.description"
            type="textarea"
            placeholder="描述角色的外貌、性格、背景等..."
            :rows="4"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showEditModal = false">取消</NButton>
          <NButton type="primary" @click="handleSaveEdit">保存</NButton>
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
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.characters-page {
  height: 100%;
}

.characters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.characters-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.characters-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.characters-header__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-gray);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
}

.characters-content {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  min-height: 400px;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.character-card {
  overflow: hidden;
  transition: all var(--transition-fast);
}

.character-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
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
  gap: 2px;
  padding: 2px;
  background: white;
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
  margin-bottom: var(--spacing-md);
}

.character-card__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
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
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}
</style>
