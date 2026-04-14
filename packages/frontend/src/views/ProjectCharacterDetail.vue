<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue'
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
import type { Character, CharacterImage } from '@dreamer/shared/types'
import { subscribeProjectUpdates } from '@/lib/project-sse-bridge'
import { getDisplayBaseImages, getDisplayDerivedImages } from '@/lib/character-image-groups'

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
const addForm = ref({
  name: '',
  type: 'base',
  parentId: undefined as string | undefined,
  description: ''
})
const isUploading = ref(false)
const selectedFile = ref<File | null>(null)
const promptDraft = ref('')
const generatingByImageId = ref<Record<string, boolean>>({})
let unsubProjectSse: (() => void) | null = null

onMounted(async () => {
  await loadCharacter()
  unsubProjectSse = subscribeProjectUpdates(projectId.value, (p) => {
    if (p.type !== 'image-generation') return
    const ours =
      p.characterId === characterId.value ||
      (typeof p.characterImageId === 'string' &&
        character.value?.images?.some((i) => i.id === p.characterImageId))
    if (!ours) return
    if (p.characterImageId && (p.status === 'completed' || p.status === 'failed')) {
      const id = p.characterImageId as string
      const next = { ...generatingByImageId.value }
      delete next[id]
      generatingByImageId.value = next
    }
    if (p.status === 'completed' && p.characterImageId) {
      void loadCharacter()
      message.success('形象图已更新')
    }
    if (p.status === 'failed' && String(p.kind || '').startsWith('character')) {
      message.error((p.error as string) || '形象生成失败')
    }
  })
})

onUnmounted(() => {
  unsubProjectSse?.()
  unsubProjectSse = null
})

watch(
  () => [selectedImageId.value, character.value?.images] as const,
  () => {
    const img = character.value?.images?.find((i) => i.id === selectedImageId.value)
    promptDraft.value = img?.prompt || ''
  },
  { immediate: true, deep: true }
)

const loadCharacter = async () => {
  isLoading.value = true
  try {
    character.value = await characterStore.getCharacter(characterId.value)
    const imgs = character.value?.images || []
    const keep = selectedImageId.value && imgs.some((i) => i.id === selectedImageId.value)
    const id = keep ? selectedImageId.value : imgs[0]?.id
    if (id) {
      selectedImageId.value = id
      selectedImage.value = imgs.find((i) => i.id === id) || null
    } else {
      selectedImageId.value = null
      selectedImage.value = null
    }
  } finally {
    isLoading.value = false
  }
}

function sortImagesByOrder(a: CharacterImage, b: CharacterImage): number {
  return (a.order ?? 0) - (b.order ?? 0)
}

function formatImageCostYuan(n: number): string {
  return n.toFixed(4)
}

const treeData = computed<TreeOption[]>(() => {
  if (!character.value?.images) return []

  const images = character.value.images
  const imageMap = new Map<string, TreeOption>()
  images.forEach((img) => {
    imageMap.set(img.id, {
      key: img.id,
      label: img.name,
      data: img,
      children: []
    })
  })

  function subtree(parentId: string): TreeOption[] {
    return images
      .filter((i) => i.parentId === parentId)
      .sort(sortImagesByOrder)
      .map((i) => {
        const raw = imageMap.get(i.id)!
        return { ...raw, children: subtree(i.id) }
      })
  }

  const bases = getDisplayBaseImages(images)
  return bases.map((base) => {
    const raw = imageMap.get(base.id)!
    const topLevel = getDisplayDerivedImages(images, base.id).map((img) => {
      const n = imageMap.get(img.id)!
      return { ...n, children: subtree(img.id) }
    })
    topLevel.sort((a, b) => sortImagesByOrder(a.data as CharacterImage, b.data as CharacterImage))
    return { ...raw, children: topLevel }
  })
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
    parentId,
    description: ''
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

const addByAiLoading = ref(false)
const confirmAddImageByAi = async () => {
  if (!addForm.value.name.trim()) {
    message.warning('请输入形象名称')
    return
  }
  addByAiLoading.value = true
  try {
    await characterStore.addImageSlotByAi(characterId.value, {
      name: addForm.value.name.trim(),
      type: addForm.value.type,
      parentId: addForm.value.parentId,
      description: addForm.value.description?.trim() || undefined
    })
    showAddModal.value = false
    selectedFile.value = null
    message.success('已创建槽位，可编辑英文提示词后点「提交生成」')
    await loadCharacter()
  } catch (e: any) {
    message.error(e?.response?.data?.error || '创建失败')
  } finally {
    addByAiLoading.value = false
  }
}

async function savePromptDraft() {
  if (!selectedImage.value) return
  try {
    await characterStore.updateImage(characterId.value, selectedImage.value.id, {
      prompt: promptDraft.value || null
    })
    message.success('提示词已保存')
    await loadCharacter()
  } catch (e: any) {
    message.error(e?.response?.data?.error || '保存失败')
  }
}

async function queueSelectedGenerate() {
  if (!selectedImage.value) return
  const id = selectedImage.value.id
  generatingByImageId.value = { ...generatingByImageId.value, [id]: true }
  try {
    await characterStore.queueCharacterImageGenerate(id)
    message.info('已提交生成，请稍候…')
  } catch (e: any) {
    const next = { ...generatingByImageId.value }
    delete next[id]
    generatingByImageId.value = next
    message.error(e?.response?.data?.error || '提交失败')
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

  const img = selectedImage.value
  const images = character.value?.images || []
  const options: { label: string; key: string }[] = []

  const bases = getDisplayBaseImages(images)
  const primary = bases[0]
  const looseUnderPrimary =
    !img.parentId && img.type !== 'base' && primary?.type === 'base' && Boolean(primary.id)

  if (img.type === 'base' && !img.parentId) {
    options.push({ label: img.avatarUrl ? 'AI 重新生成' : 'AI 生成定妆', key: 'ai-generate' })
  } else {
    const parentId = img.parentId || (looseUnderPrimary ? primary!.id : undefined)
    const parent = parentId ? images.find((i) => i.id === parentId) : undefined
    if (parent?.avatarUrl) {
      options.push({ label: img.avatarUrl ? 'AI 重新生成' : 'AI 生成', key: 'ai-generate' })
    }
  }

  options.push({ label: '添加子形象', key: 'add-child' })
  if (looseUnderPrimary && primary) {
    options.push({ label: `关联到「${primary.name}」`, key: 'attach-primary' })
  }
  if (img.parentId) {
    options.push({ label: '设为独立形象', key: 'detach' })
  }
  options.push({ label: '删除', key: 'delete' })

  return options
})

const handleImageAction = async (key: string) => {
  if (!selectedImage.value) return

  switch (key) {
    case 'ai-generate':
      void queueSelectedGenerate()
      break
    case 'add-child':
      openAddModal(selectedImage.value.id)
      break
    case 'attach-primary': {
      const imgs = character.value?.images || []
      const p = getDisplayBaseImages(imgs)[0]
      if (p) {
        await characterStore.moveImage(characterId.value, selectedImage.value.id, p.id)
        message.success('已关联到主形象')
        await loadCharacter()
      }
      break
    }
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
              <p
                v-if="selectedImage.imageCost != null && selectedImage.imageCost > 0"
                class="preview-cost muted"
              >
                本图成本（估算）¥{{ formatImageCostYuan(selectedImage.imageCost) }}
              </p>
              <p v-if="selectedImage.description" class="preview-desc">
                {{ selectedImage.description }}
              </p>
              <p v-if="selectedImage.parentId" class="preview-parent">
                衍生自: {{ character.images?.find(i => i.id === selectedImage.parentId)?.name }}
              </p>
              <div class="prompt-block">
                <h5 class="prompt-block__title">文生图提示词（英文）</h5>
                <NInput
                  v-model:value="promptDraft"
                  type="textarea"
                  placeholder="解析或手动填写；保存后再生成"
                  :rows="4"
                />
                <NSpace style="margin-top: 10px" wrap>
                  <NButton size="small" @click="savePromptDraft">保存提示词</NButton>
                  <NButton
                    size="small"
                    type="primary"
                    :loading="generatingByImageId[selectedImage.id]"
                    :disabled="!!selectedImage.parentId && !character.images?.find((i) => i.id === selectedImage.parentId)?.avatarUrl"
                    @click="queueSelectedGenerate"
                  >
                    提交 AI 生成
                  </NButton>
                </NSpace>
              </div>
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
            <div class="prompt-block" style="margin-top: 12px">
              <h5 class="prompt-block__title">文生图提示词</h5>
              <NInput v-model:value="promptDraft" type="textarea" :rows="3" />
              <NSpace style="margin-top: 8px">
                <NButton size="tiny" @click="savePromptDraft">保存</NButton>
                <NButton
                  size="tiny"
                  type="primary"
                  :loading="generatingByImageId[selectedImage.id]"
                  @click="queueSelectedGenerate"
                >
                  生成
                </NButton>
              </NSpace>
            </div>
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
        <NFormItem v-if="addForm.parentId" label="说明（可选，AI 建槽用）" path="description">
          <NInput v-model:value="addForm.description" type="textarea" :rows="2" placeholder="如：夜礼服、战斗伤痕妆" />
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
          <NButton secondary :loading="addByAiLoading" @click="confirmAddImageByAi">
            不上传图，AI 建槽位
          </NButton>
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
