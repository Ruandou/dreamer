<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NSpace,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NImage,
  NUpload,
  NTag,
  useMessage,
  useDialog,
  NTree,
  NPopconfirm,
  NSpin,
  NBackTop,
  NAlert
} from 'naive-ui'
import type { UploadFileInfo, TreeOption } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import EmptyState from '@/components/EmptyState.vue'
import type { Character, CharacterImage } from '@dreamer/shared/types'
import { subscribeProjectUpdates } from '@/lib/project-sse-bridge'
import {
  getDisplayBaseImages,
  getDisplayDerivedImages,
  hasRootBaseImage,
  isRootBaseImage
} from '@/lib/character-image-groups'
import { fetchInFlightImageJobsForProject } from '@/lib/pending-image-jobs'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const characterStore = useCharacterStore()

const projectId = computed(() => route.params.id as string)
const characterId = computed(() => route.params.characterId as string)

const character = ref<Character | null>(null)
const isLoading = ref(true)
const selectedImageId = ref<string | null>(null)
const selectedImage = ref<CharacterImage | null>(null)
const showAddModal = ref(false)
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
const uploadingAvatar = ref(false)
const batchGeneratingCharacter = ref(false)
let unsubProjectSse: (() => void) | null = null

type CharacterTreeOption = TreeOption & { data?: CharacterImage }

/** 与角色库列表一致：沿用 store 顺序（同 GET /characters，按创建时间升序） */
const projectCharactersInListOrder = computed(() =>
  characterStore.characters.filter((c) => c.projectId === projectId.value)
)

/** 多于一个角色时显示左侧切换栏（与列表顺序一致） */
const showCharacterRail = computed(() => projectCharactersInListOrder.value.length > 1)

watch(
  projectId,
  (pid) => {
    if (pid) void characterStore.fetchCharacters(pid)
  },
  { immediate: true }
)

onMounted(() => {
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

/** 右侧详情必须以 character.images 为准；树节点上的 option.data 可能与刷新后的数组不同步 */
watch(
  () => [selectedImageId.value, character.value?.images] as const,
  () => {
    const id = selectedImageId.value
    const imgs = character.value?.images
    if (!id || !imgs?.length) {
      selectedImage.value = null
      promptDraft.value = ''
      return
    }
    const img = imgs.find((i) => i.id === id) ?? null
    selectedImage.value = img
    promptDraft.value = img?.prompt || ''
  },
  { immediate: true, deep: true }
)

/** 刷新后从 BullMQ 恢复「生成中」按钮状态 */
async function hydrateGeneratingFromQueue() {
  try {
    const { characterImageIds } = await fetchInFlightImageJobsForProject(projectId.value)
    const imgs = character.value?.images || []
    const next = { ...generatingByImageId.value }
    for (const id of characterImageIds) {
      if (imgs.some((i) => i.id === id)) {
        next[id] = true
      }
    }
    generatingByImageId.value = next
  } catch {
    // 忽略拉取失败
  }
}

async function handleAvatarUpload(options: { file: UploadFileInfo }) {
  if (options.file.status === 'error' || options.file.status === 'removed') return
  const f = options.file.file
  if (!f || !selectedImage.value) return
  uploadingAvatar.value = true
  try {
    await characterStore.uploadCharacterImageAvatar(
      characterId.value,
      selectedImage.value.id,
      f
    )
    message.success('已上传')
    await loadCharacter()
  } catch (e: any) {
    const err = e?.response?.data?.error
    message.error(typeof err === 'string' ? err : e?.message || '上传失败')
  } finally {
    uploadingAvatar.value = false
  }
}

const loadCharacter = async () => {
  isLoading.value = true
  try {
    character.value = await characterStore.getCharacter(characterId.value)
    const imgs = character.value?.images || []
    const keep = selectedImageId.value && imgs.some((i) => i.id === selectedImageId.value)
    const id = keep ? selectedImageId.value : imgs[0]?.id
    if (id) {
      selectedImageId.value = id
    } else {
      selectedImageId.value = null
    }
  } finally {
    isLoading.value = false
  }
}

watch(
  characterId,
  async () => {
    await loadCharacter()
    await hydrateGeneratingFromQueue()
  },
  { immediate: true }
)

async function switchProjectCharacter(targetId: string) {
  if (targetId === characterId.value) return
  const ok = await savePromptDraftIfDirty(true)
  if (!ok) return
  await router.push(`/project/${projectId.value}/characters/${targetId}`)
}

function sortImagesByOrder(a: CharacterImage, b: CharacterImage): number {
  return (a.order ?? 0) - (b.order ?? 0)
}

function formatImageCostYuan(n: number): string {
  return n.toFixed(4)
}

const characterHasRootBase = computed(() => hasRootBaseImage(character.value?.images))

/** 多条无父级 base（历史数据）：提示合并删除 */
const multipleRootBases = computed(() => {
  const imgs = character.value?.images ?? []
  return imgs.filter((i) => i.type === 'base' && !i.parentId).length > 1
})

const treeData = computed<CharacterTreeOption[]>(() => {
  if (!character.value?.images) return []

  const images = character.value.images
  const imageMap = new Map<string, CharacterTreeOption>()
  images.forEach((img) => {
    imageMap.set(img.id, {
      key: img.id,
      label: img.name,
      data: img,
      children: []
    })
  })

  function subtree(parentId: string): CharacterTreeOption[] {
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
    topLevel.sort((a, b) =>
      sortImagesByOrder(a.data as CharacterImage, b.data as CharacterImage)
    )
    return { ...raw, children: topLevel }
  })
})

function onTreeSelectedKeys(keys: Array<string | number>) {
  const k = keys[0]
  selectedImageId.value = k != null ? String(k) : null
}

const handleBack = () => {
  router.push(`/project/${projectId.value}/characters`)
}

const handleDeleteImage = async (imageId: string) => {
  await characterStore.deleteImage(characterId.value, imageId)
  message.success('形象已删除')
  await loadCharacter()
}

const openAddModal = () => {
  addForm.value = {
    name: '',
    type: 'base',
    parentId: undefined,
    description: ''
  }
  selectedFile.value = null
  showAddModal.value = true
}

const handleFileChange = (options: { file: UploadFileInfo }) => {
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
    message.success('已创建槽位，可编辑提示词后点「AI生成」')
    await loadCharacter()
  } catch (e: any) {
    message.error(e?.response?.data?.error || '创建失败')
  } finally {
    addByAiLoading.value = false
  }
}

function isPromptDirty(): boolean {
  if (!selectedImage.value) return false
  return (
    (promptDraft.value || '').trim() !== (selectedImage.value.prompt || '').trim()
  )
}

/** 有未保存改动时写入服务端；silent 时不弹出「已保存」 */
async function savePromptDraftIfDirty(silent = false): Promise<boolean> {
  if (!selectedImage.value || !isPromptDirty()) return true
  try {
    await characterStore.updateImage(characterId.value, selectedImage.value.id, {
      prompt: promptDraft.value || null
    })
    if (!silent) message.success('已保存')
    await loadCharacter()
    return true
  } catch (e: any) {
    message.error(e?.response?.data?.error || '保存失败')
    return false
  }
}

async function savePromptDraft() {
  if (!selectedImage.value) return
  await savePromptDraftIfDirty(false)
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
  const ok = await savePromptDraftIfDirty(true)
  if (!ok) return
  batchGeneratingCharacter.value = true
  try {
    const data = await characterStore.batchGenerateMissingCharacterAvatars(projectId.value, {
      characterId: characterId.value
    })
    const { enqueued, skipped } = data
    if (enqueued > 0) {
      message.success(`已入队 ${enqueued} 个定妆生成任务`)
      void hydrateGeneratingFromQueue()
    } else {
      message.warning('没有可生成的槽位（需提示词且无定妆图，衍生需父级已出图）')
    }
    if (skipped.length > 0) {
      const reasons = [...new Set(skipped.map((s) => s.reason))]
      message.info(`已跳过 ${skipped.length} 个：${reasons.join('；')}`)
    }
  } catch (e: any) {
    message.error(e?.response?.data?.error || '批量入队失败')
  } finally {
    batchGeneratingCharacter.value = false
  }
}

async function queueSelectedGenerate() {
  if (!selectedImage.value) return
  const id = selectedImage.value.id
  const ok = await savePromptDraftIfDirty(true)
  if (!ok) return
  generatingByImageId.value = { ...generatingByImageId.value, [id]: true }
  try {
    const p = promptDraft.value.trim()
    await characterStore.queueCharacterImageGenerate(id, p ? { prompt: p } : undefined)
    message.info('已提交生成，请稍候…')
  } catch (e: any) {
    const next = { ...generatingByImageId.value }
    delete next[id]
    generatingByImageId.value = next
    message.error(e?.response?.data?.error || '提交失败')
  }
}

const handleDrop = async ({
  node,
  dragNode,
  dropPosition
}: {
  node: TreeOption
  dragNode: TreeOption
  dropPosition: 'before' | 'after' | 'inside'
}) => {
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

const treeNodeProps = (option: CharacterTreeOption) => ({
  onDrop: (e: DragEvent) => {
    e.preventDefault()
    const dragNode = JSON.parse(e.dataTransfer?.getData('node') || '{}')
    const idx = (e as unknown as { index?: number }).index
    const dropPosition = idx === 0 ? 'inside' : idx === 1 ? 'after' : 'before'
    void handleDrop({ node: option, dragNode, dropPosition })
  },
  onDragover: (e: DragEvent) => e.preventDefault(),
  draggable: true
})

/** 与场地卡片 header-extra 一致：需挂回主基础时显示「关联」 */
const selectedImageLoosePrimary = computed(() => {
  if (!selectedImage.value || !character.value?.images) return null
  const img = selectedImage.value
  const images = character.value.images
  const bases = getDisplayBaseImages(images)
  const primary = bases[0]
  const looseUnderPrimary =
    !img.parentId && img.type !== 'base' && primary?.type === 'base' && Boolean(primary.id)
  if (!looseUnderPrimary || !primary) return null
  return { primaryName: primary.name }
})

const selectedImageCanDelete = computed(() =>
  selectedImage.value ? !isRootBaseImage(selectedImage.value) : false
)

async function handleAttachToPrimary() {
  const imgs = character.value?.images || []
  const p = getDisplayBaseImages(imgs)[0]
  const sel = selectedImage.value
  if (!p || !sel) return
  await characterStore.moveImage(characterId.value, sel.id, p.id)
  message.success('已关联到主形象')
  await loadCharacter()
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

/** 供模板在回调外安全读取（避免 v-if 收窄在箭头函数内丢失） */
const selectedImageParentName = computed(() => {
  const s = selectedImage.value
  const pid = s?.parentId
  if (!pid) return undefined
  return character.value?.images?.find((i) => i.id === pid)?.name
})

const selectedImageGenerateDisabled = computed(() => {
  const s = selectedImage.value
  if (!s) return true
  if (!s.parentId) return false
  return !character.value?.images?.find((i) => i.id === s.parentId)?.avatarUrl
})

const renderSuffix = ({ option }: { option: CharacterTreeOption }) => {
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
        <NButton v-if="!characterHasRootBase" type="primary" @click="openAddModal()">
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
      description="每角色仅一个基础定妆；添加后可在此管理衍生形象与提示词"
      icon="🎭"
    >
      <template #action>
        <NButton type="primary" size="large" @click="openAddModal()">
          添加第一个形象
        </NButton>
      </template>
    </EmptyState>

    <!-- Content -->
    <div
      v-else
      class="detail-content"
      :class="{ 'detail-content--with-rail': showCharacterRail }"
    >
      <aside
        v-if="showCharacterRail"
        class="character-rail character-rail--tabs"
        aria-label="切换角色"
      >
        <div class="character-rail__title">角色</div>
        <nav class="character-rail__tablist" role="tablist">
          <button
            v-for="c in projectCharactersInListOrder"
            :key="c.id"
            type="button"
            role="tab"
            class="character-rail__tab"
            :class="{ 'character-rail__tab--active': c.id === characterId }"
            :aria-selected="c.id === characterId"
            @click="switchProjectCharacter(c.id)"
          >
            {{ c.name }}
          </button>
        </nav>
      </aside>

      <!-- Tree View -->
      <div class="tree-panel">
        <div class="tree-panel__header">
          <div class="tree-panel__title-wrap">
            <h3>形象结构</h3>
            <p class="tree-panel__hint">基础定妆向下分支为衍生；点击行切换右侧详情，三角仅展开/收起</p>
          </div>
          <NButton
            size="small"
            type="primary"
            secondary
            :loading="batchGeneratingCharacter"
            :disabled="!character"
            @click="batchGenerateThisCharacter"
          >
            AI一键生成
          </NButton>
        </div>
        <NAlert
          v-if="multipleRootBases"
          type="warning"
          show-icon
          style="margin-bottom: 12px"
          title="检测到多个基础定妆"
        >
          当前规则为每角色仅保留一个无父级的「基础」槽。请将多余项改为衍生（指定父级）或修改类型后，再删除不需要的节点；基础定妆本身不可删除。
        </NAlert>
        <div class="tree-panel__body">
          <NTree
            class="character-image-tree"
            :data="treeData"
            block-line
            show-line
            default-expand-all
            :cancelable="false"
            selectable
            :selected-keys="selectedImageId ? [selectedImageId] : []"
            @update:selected-keys="onTreeSelectedKeys"
            :node-props="treeNodeProps"
            :render-suffix="renderSuffix"
          />
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="preview-panel">
        <div class="preview-panel__header">
          <h3>形象详情</h3>
          <NSpace
            v-if="
              selectedImage &&
              (selectedImageLoosePrimary || selectedImageCanDelete)
            "
            :size="8"
            align="center"
            wrap
          >
            <NButton
              v-if="selectedImageLoosePrimary"
              size="tiny"
              quaternary
              :disabled="!!generatingByImageId[selectedImage.id]"
              @click="handleAttachToPrimary"
            >
              关联到「{{ selectedImageLoosePrimary.primaryName }}」
            </NButton>
            <NPopconfirm
              v-if="selectedImageCanDelete"
              positive-text="删除"
              negative-text="取消"
              @positive-click="handleDeleteImage(selectedImage.id)"
            >
              <template #trigger>
                <NButton
                  size="tiny"
                  quaternary
                  type="error"
                  :disabled="!!generatingByImageId[selectedImage.id]"
                >
                  删除
                </NButton>
              </template>
              确定删除形象「{{ selectedImage.name }}」？衍生节点将一并删除。
            </NPopconfirm>
          </NSpace>
        </div>
        <div class="preview-panel__body">
          <template v-if="selectedImage">
            <NSpin
              :show="!!generatingByImageId[selectedImage.id]"
              size="small"
              description="生成中…"
              class="preview-panel-spin"
            >
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
                  :disabled="uploadingAvatar || generatingByImageId[selectedImage.id]"
                  @change="handleAvatarUpload"
                >
                  <NButton
                    size="small"
                    :loading="uploadingAvatar"
                    :disabled="generatingByImageId[selectedImage.id]"
                  >
                    本地上传
                  </NButton>
                </NUpload>
              </div>
              <div v-if="selectedImage.avatarUrl" class="preview-image-replace">
                <NUpload
                  accept="image/jpeg,image/png,image/webp"
                  :max="1"
                  :show-file-list="false"
                  :disabled="uploadingAvatar || generatingByImageId[selectedImage.id]"
                  @change="handleAvatarUpload"
                >
                  <NButton
                    size="tiny"
                    quaternary
                    :loading="uploadingAvatar"
                    :disabled="generatingByImageId[selectedImage.id]"
                  >
                    本地上传
                  </NButton>
                </NUpload>
              </div>
            </div>
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
                衍生自: {{ selectedImageParentName }}
              </p>
              <div class="prompt-block">
                <h5 class="prompt-block__title">文生图提示词（中文）</h5>
                <NInput
                  v-model:value="promptDraft"
                  type="textarea"
                  placeholder="解析或手动填写；保存后再生成"
                  :rows="4"
                  style="margin-top: 8px"
                />
                <NSpace style="margin-top: 8px" justify="end" wrap>
                  <NButton size="small" @click="savePromptDraft">保存</NButton>
                  <NUpload
                    accept="image/jpeg,image/png,image/webp"
                    :max="1"
                    :show-file-list="false"
                    :disabled="uploadingAvatar || generatingByImageId[selectedImage.id]"
                    @change="handleAvatarUpload"
                  >
                    <NButton
                      size="small"
                      :loading="uploadingAvatar"
                      :disabled="generatingByImageId[selectedImage.id]"
                    >
                      本地上传
                    </NButton>
                  </NUpload>
                  <NButton
                    size="small"
                    type="primary"
                    :loading="generatingByImageId[selectedImage.id]"
                    :disabled="selectedImageGenerateDisabled || uploadingAvatar"
                    @click="queueSelectedGenerate"
                  >
                    AI生成
                  </NButton>
                </NSpace>
              </div>
            </div>
            </div>
            </NSpin>
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
  margin-bottom: var(--spacing-md);
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

.detail-content--with-rail {
  grid-template-columns: 172px minmax(260px, 360px) minmax(0, 1fr);
  gap: var(--spacing-md);
}

/* 左侧纵向 Tab（线型 + 当前项指示条，与 Naive line tabs 气质一致） */
.character-rail--tabs {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.character-rail__title {
  flex-shrink: 0;
  padding: 10px 12px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-gray);
}

.character-rail__tablist {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.character-rail__tab {
  position: relative;
  text-align: left;
  width: 100%;
  padding: 10px 14px 10px 12px;
  margin: 0;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  background: transparent;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-rail__tab:last-child {
  border-bottom: none;
}

.character-rail__tab:hover:not(.character-rail__tab--active) {
  background: var(--color-bg-gray);
}

.character-rail__tab--active {
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  background: var(--color-primary-light);
}

.character-rail__tab--active::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-primary);
  border-radius: 2px 0 0 2px;
}

.character-rail__tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
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
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.tree-panel__title-wrap {
  min-width: 0;
}

.tree-panel__header h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.tree-panel__hint {
  margin: 4px 0 0;
  font-size: var(--font-size-xs);
  line-height: 1.45;
  color: var(--color-text-tertiary);
}

.character-image-tree {
  --n-node-content-height: 34px;
}

.character-image-tree :deep(.n-tree-node-wrapper) {
  padding-top: 2px;
  padding-bottom: 2px;
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
