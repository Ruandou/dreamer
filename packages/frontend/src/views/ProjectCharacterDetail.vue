<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput,
  NImage, NImageGroup, NUpload, NPopconfirm, NTag, NTooltip,
  NAvatar, useMessage, NIcon, NTree, NDropdown, NDrawer, NDrawerContent,
  NSpin, NBackTop
} from 'naive-ui'
import type { UploadFile, TreeOption } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import EmptyState from '@/components/EmptyState.vue'
import type { Character, CharacterImage } from '@shared/types'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const characterStore = useCharacterStore()

const projectId = computed(() => route.params.id as string)
const characterId = computed(() => route.params.characterId as string)

const character = ref<Character | null>(null)
const isLoading = ref(true)
const selectedImageId = ref<string | null>(null)
const selectedImage = ref<CharacterImage | null>(null)
const showImageDrawer = ref(false)
const showEditModal = ref(false)
const showAddModal = ref(false)
const editForm = ref({ name: '', description: '', type: 'base', parentId: undefined as string | undefined })
const addForm = ref({ name: '', type: 'base', parentId: undefined as string | undefined })
const isUploading = ref(false)
const selectedFile = ref<File | null>(null)

onMounted(async () => {
  await loadCharacter()
})

const loadCharacter = async () => {
  isLoading.value = true
  try {
    character.value = await characterStore.getCharacter(characterId.value)
    if (character.value?.images?.length) {
      selectedImageId.value = character.value.images[0].id
    }
  } finally {
    isLoading.value = false
  }
}

const treeData = computed<TreeOption[]>(() => {
  if (!character.value?.images) return []

  const imageMap = new Map<string, TreeOption>()
  const roots: TreeOption[] = []

  character.value.images.forEach(img => {
    imageMap.set(img.id, {
      key: img.id,
      label: img.name,
      data: img,
      children: []
    })
  })

  character.value.images.forEach(img => {
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
})

const handleNodeClick = (option: TreeOption) => {
  selectedImageId.value = option.key as string
  selectedImage.value = option.data as CharacterImage
  showImageDrawer.value = true
}

const handleBack = () => {
  router.push(`/project/${projectId.value}/characters`)
}

const handleDeleteImage = async (imageId: string) => {
  await characterStore.deleteImage(characterId.value, imageId)
  message.success('形象已删除')
  await loadCharacter()
}

const handleMoveToRoot = async (imageId: string) => {
  await characterStore.moveImage(characterId.value, imageId, undefined)
  message.success('已移为独立形象')
  await loadCharacter()
}

const openAddModal = (parentId?: string) => {
  addForm.value = {
    name: '',
    type: parentId ? 'outfit' : 'base',
    parentId
  }
  selectedFile.value = null
  showAddModal.value = true
}

const handleFileChange = (options: { file: UploadFile }) => {
  selectedFile.value = options.file.file as File
}

const confirmAddImage = async () => {
  if (!addForm.value.name) {
    message.warning('请输入形象名称')
    return
  }
  if (!selectedFile.value) {
    message.warning('请选择图片')
    return
  }

  isUploading.value = true
  try {
    await characterStore.addImage(
      characterId.value,
      selectedFile.value,
      addForm.value.name,
      addForm.value.parentId,
      addForm.value.type
    )
    showAddModal.value = false
    selectedFile.value = null
    message.success('形象添加成功')
    await loadCharacter()
  } finally {
    isUploading.value = false
  }
}

const handleDrop = async ({ node, dragNode, dropPosition }: { node: TreeOption, dragNode: TreeOption, dropPosition: 'before' | 'after' | 'inside' }) => {
  const dragImage = dragNode.data as CharacterImage
  const targetImage = node.data as CharacterImage

  let newParentId: string | undefined

  if (dropPosition === 'inside') {
    newParentId = targetImage.id
  } else if (dropPosition === 'before' || dropPosition === 'after') {
    newParentId = targetImage.parentId || undefined
  }

  if (dragImage.parentId !== newParentId) {
    await characterStore.moveImage(characterId.value, dragImage.id, newParentId)
    message.success('形象已移动')
    await loadCharacter()
  }
}

const imageActionOptions = computed(() => {
  if (!selectedImage.value) return []

  const options = [
    { label: '添加子形象', key: 'add-child' },
    { label: '删除', key: 'delete' }
  ]

  if (selectedImage.value.parentId) {
    options.unshift({ label: '设为独立形象', key: 'detach' })
  }

  return options
})

const handleImageAction = (key: string) => {
  if (!selectedImage.value) return

  switch (key) {
    case 'add-child':
      openAddModal(selectedImage.value.id)
      break
    case 'delete':
      handleDeleteImage(selectedImage.value.id)
      break
    case 'detach':
      handleMoveToRoot(selectedImage.value.id)
      break
  }
  showImageDrawer.value = false
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

const getTypeTagType = (type: string): 'success' | 'info' | 'warning' | 'default' => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
    base: 'success',
    outfit: 'info',
    expression: 'warning',
    pose: 'default'
  }
  return map[type] || 'default'
}

const renderSuffix = ({ option }: { option: TreeOption }) => {
  const img = option.data as CharacterImage
  return h('div', { class: 'tree-node-suffix' }, [
    h(NTag, {
      size: 'tiny',
      type: getTypeTagType(img.type),
      bordered: false
    }, () => getTypeLabel(img.type))
  ])
}

import { h } from 'vue'
</script>

<template>
  <div class="character-detail-page">
    <!-- Header -->
    <header class="detail-header">
      <div class="detail-header__left">
        <NButton quaternary @click="handleBack">
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </template>
          返回
        </NButton>
        <div class="detail-header__info" v-if="character">
          <h1 class="detail-header__title">{{ character.name }}</h1>
          <p class="detail-header__desc">{{ character.description || '暂无描述' }}</p>
        </div>
      </div>
      <div class="detail-header__right">
        <NButton type="primary" @click="openAddModal()">
          <template #icon>+</template>
          添加基础形象
        </NButton>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="detail-loading">
      <NSpin size="large" />
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="!character || treeData.length === 0"
      title="暂无形象"
      description="添加角色的基础形象和衍生形象"
      icon="🎭"
    >
      <template #action>
        <NButton type="primary" size="large" @click="openAddModal()">
          添加第一个形象
        </NButton>
      </template>
    </EmptyState>

    <!-- Content -->
    <div v-else class="detail-content">
      <!-- Tree View -->
      <div class="tree-panel">
        <div class="tree-panel__header">
          <h3>形象树</h3>
          <NTag size="small" round>{{ treeData.length }} 个基础形象</NTag>
        </div>
        <div class="tree-panel__body">
          <NTree
            :data="treeData"
            block-node
            expand-on-click
            selectable
            :selected-keys="selectedImageId ? [selectedImageId] : []"
            :default-expanded-keys="treeData.map(n => n.key as string)"
            :node-props="(option: TreeOption) => ({
              onClick: () => handleNodeClick(option),
              onDrop: (e: DragEvent) => {
                e.preventDefault()
                const dragNode = JSON.parse(e.dataTransfer?.getData('node') || '{}')
                const dropPosition = e.index === 0 ? 'inside' : (e.index === 1 ? 'after' : 'before')
                handleDrop({ node: option, dragNode, dropPosition })
              },
              onDragover: (e: DragEvent) => e.preventDefault(),
              draggable: true
            })"
            :render-suffix="renderSuffix"
          />
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="preview-panel">
        <div class="preview-panel__header">
          <h3>形象详情</h3>
          <NDropdown
            v-if="selectedImage"
            trigger="click"
            :options="imageActionOptions"
            @select="handleImageAction"
          >
            <NButton size="small">操作 ⋯</NButton>
          </NDropdown>
        </div>
        <div class="preview-panel__body">
          <template v-if="selectedImage">
            <NImage
              :src="selectedImage.avatarUrl || ''"
              width="100%"
              height="400"
              object-fit="contain"
              style="background: #f5f5f5; border-radius: 8px;"
            />
            <div class="preview-info">
              <h4>{{ selectedImage.name }}</h4>
              <NTag :type="getTypeTagType(selectedImage.type)" size="small">
                {{ getTypeLabel(selectedImage.type) }}
              </NTag>
              <p v-if="selectedImage.description" class="preview-desc">
                {{ selectedImage.description }}
              </p>
              <p v-if="selectedImage.parentId" class="preview-parent">
                衍生自: {{ character.images?.find(i => i.id === selectedImage.parentId)?.name }}
              </p>
            </div>
          </template>
          <EmptyState
            v-else
            title="选择形象"
            description="点击左侧树节点查看详情"
            icon="👈"
          />
        </div>
      </div>
    </div>

    <!-- Image Drawer -->
    <NDrawer v-model:show="showImageDrawer" :width="400" placement="right">
      <NDrawerContent title="形象详情" closable>
        <template #header>
          <div class="drawer-header">
            <span>形象详情</span>
            <NDropdown
              v-if="selectedImage"
              trigger="click"
              :options="imageActionOptions"
              @select="handleImageAction"
            >
              <NButton size="small">操作</NButton>
            </NDropdown>
          </div>
        </template>
        <div v-if="selectedImage" class="drawer-content">
          <NImage
            :src="selectedImage.avatarUrl || ''"
            width="100%"
            preview
          />
          <div class="drawer-info">
            <h4>{{ selectedImage.name }}</h4>
            <NTag :type="getTypeTagType(selectedImage.type)" size="small">
              {{ getTypeLabel(selectedImage.type) }}
            </NTag>
            <p v-if="selectedImage.description" class="drawer-desc">
              {{ selectedImage.description }}
            </p>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>

    <!-- Add Image Modal -->
    <NModal
      v-model:show="showAddModal"
      preset="card"
      :title="addForm.parentId ? '添加衍生形象' : '添加基础形象'"
      style="width: 480px"
    >
      <NForm :model="addForm" label-placement="top">
        <NFormItem label="形象名称" path="name">
          <NInput v-model:value="addForm.name" placeholder="如：日常装、战斗版、微笑表情" />
        </NFormItem>
        <NFormItem label="类型" path="type">
          <NSpace>
            <NTag
              v-for="t in ['base', 'outfit', 'expression', 'pose']"
              :key="t"
              :type="addForm.type === t ? (t === 'base' ? 'success' : t === 'outfit' ? 'info' : t === 'expression' ? 'warning' : 'default') : 'default'"
              :bordered="addForm.type !== t"
              checkable
              @click="addForm.type = t"
            >
              {{ t === 'base' ? '基础' : t === 'outfit' ? '服装' : t === 'expression' ? '表情' : '姿态' }}
            </NTag>
          </NSpace>
        </NFormItem>
        <NFormItem label="参考图" path="file">
          <NUpload
            accept="image/*"
            :max="1"
            :disabled="isUploading"
            @change="(options: any) => handleFileChange(options)"
          >
            <NButton :loading="isUploading">选择图片</NButton>
          </NUpload>
          <div v-if="selectedFile" class="selected-file-info">
            <span>已选择: {{ selectedFile.name }}</span>
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showAddModal = false">取消</NButton>
          <NButton type="primary" :loading="isUploading" @click="confirmAddImage">
            创建形象
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <NBackTop :right="20" :bottom="20" />
  </div>
</template>

<style scoped>
.character-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-md);
}

.detail-header__left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.detail-header__info {
  padding-top: 4px;
}

.detail-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.detail-header__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--spacing-xs) 0 0;
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

.tree-panel {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tree-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.tree-panel__header h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.tree-panel__body {
  flex: 1;
  overflow: auto;
}

.tree-node-suffix {
  margin-left: auto;
}

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
  align-items: center;
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

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.drawer-content {
  padding: var(--spacing-md) 0;
}

.drawer-info {
  padding: var(--spacing-md) 0;
}

.drawer-info h4 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm);
}

.drawer-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-md);
  line-height: var(--line-height-relaxed);
}

.selected-file-info {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-success);
}
</style>
