import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import type { Character, CharacterImage } from '@dreamer/shared/types'
import { useCharacterStore } from '@/stores/character'
import {
  getDisplayBaseImages,
  getDisplayDerivedImages,
  hasRootBaseImage,
  isRootBaseImage
} from '@/lib/character-image-groups'
import { fetchInFlightImageJobsForProject } from '@/lib/pending-image-jobs'
import { subscribeProjectUpdates } from '@/lib/project-sse-bridge'

export interface AddImageForm {
  name: string
  type: string
  parentId: string | undefined
  description: string
}

export function useCharacterDetail() {
  const route = useRoute()
  const message = useMessage()
  const characterStore = useCharacterStore()

  const projectId = computed(() => route.params.id as string)
  const characterId = computed(() => route.params.characterId as string)

  const character = ref<Character | null>(null)
  const isLoading = ref(true)
  const selectedImageId = ref<string | null>(null)
  const selectedImage = ref<CharacterImage | null>(null)
  const showAddModal = ref(false)
  const addForm = ref<AddImageForm>({
    name: '',
    type: 'base',
    parentId: undefined,
    description: ''
  })
  const isUploading = ref(false)
  const selectedFile = ref<File | null>(null)
  const promptDraft = ref('')
  const generatingByImageId = ref<Record<string, boolean>>({})
  const uploadingAvatar = ref(false)
  const batchGeneratingCharacter = ref(false)
  const addByAiLoading = ref(false)

  let unsubProjectSse: (() => void) | null = null

  // Project characters list (for rail)
  const projectCharactersInListOrder = computed(() =>
    characterStore.characters.filter((c) => c.projectId === projectId.value)
  )

  const showCharacterRail = computed(() => projectCharactersInListOrder.value.length > 1)

  // Load project characters
  watch(
    projectId,
    (pid) => {
      if (pid) void characterStore.fetchCharacters(pid)
    },
    { immediate: true }
  )

  // SSE subscription
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
        loadCharacter().catch((e: any) => {
          console.error('[character-detail] SSE loadCharacter failed', e)
          message.error(e?.response?.data?.error || '刷新角色数据失败')
        })
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

  // Sync selectedImage when selection or character.images change
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
      // ignore
    }
  }

  async function loadCharacter() {
    isLoading.value = true
    try {
      const nextCharacter = await characterStore.getCharacter(characterId.value)
      character.value = nextCharacter
      const imgs = nextCharacter?.images || []
      const keep = selectedImageId.value && imgs.some((i) => i.id === selectedImageId.value)
      const id = keep ? selectedImageId.value : imgs[0]?.id
      if (id) {
        selectedImageId.value = id
      } else {
        selectedImageId.value = null
      }
      // 直接同步更新 selectedImage，避免 watch 异步触发导致的竞态或缓存引用问题
      if (id && imgs.length) {
        const img = imgs.find((i) => i.id === id) ?? null
        selectedImage.value = img
        promptDraft.value = img?.prompt || ''
      } else {
        selectedImage.value = null
        promptDraft.value = ''
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || '加载角色数据失败')
      throw e
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

  function sortImagesByOrder(a: CharacterImage, b: CharacterImage): number {
    return (a.order ?? 0) - (b.order ?? 0)
  }

  // Tree data computed
  const treeData = computed(() => {
    if (!character.value?.images) return []

    const images = character.value.images
    const imageMap = new Map<
      string,
      { key: string; label: string; data: CharacterImage; children: any[] }
    >()
    images.forEach((img) => {
      imageMap.set(img.id, {
        key: img.id,
        label: img.name,
        data: img,
        children: []
      })
    })

    function subtree(parentId: string): Array<{
      key: string
      label: string
      data: CharacterImage
      children: ReturnType<typeof subtree>
    }> {
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

  // Computed helpers
  const characterHasRootBase = computed(() => hasRootBaseImage(character.value?.images))

  const multipleRootBases = computed(() => {
    const imgs = character.value?.images ?? []
    return imgs.filter((i) => i.type === 'base' && !i.parentId).length > 1
  })

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

  // Actions
  function openAddModal() {
    addForm.value = {
      name: '',
      type: 'base',
      parentId: undefined,
      description: ''
    }
    selectedFile.value = null
    showAddModal.value = true
  }

  function closeAddModal() {
    showAddModal.value = false
  }

  function handleFileChange(options: { file: { file?: File | null } }) {
    selectedFile.value = options.file.file ?? null
  }

  async function handleAvatarUpload(options: { file: { status?: string; file?: File | null } }) {
    if (options.file.status === 'error' || options.file.status === 'removed') return
    const f = options.file.file
    if (!f || !selectedImage.value) return
    uploadingAvatar.value = true
    try {
      await characterStore.uploadCharacterImageAvatar(characterId.value, selectedImage.value.id, f)
      message.success('已上传')
      await loadCharacter()
    } catch (e: any) {
      const err = e?.response?.data?.error
      message.error(typeof err === 'string' ? err : e?.message || '上传失败')
    } finally {
      uploadingAvatar.value = false
    }
  }

  async function handleDeleteImage(imageId: string) {
    await characterStore.deleteImage(characterId.value, imageId)
    message.success('形象已删除')
    await loadCharacter()
  }

  async function confirmAddImage() {
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

  async function confirmAddImageByAi() {
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
    return (promptDraft.value || '').trim() !== (selectedImage.value.prompt || '').trim()
  }

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

  function formatImageCostYuan(n: number): string {
    return n.toFixed(4)
  }

  async function handleAttachToPrimary() {
    const imgs = character.value?.images || []
    const p = getDisplayBaseImages(imgs)[0]
    const sel = selectedImage.value
    if (!p || !sel) return
    await characterStore.moveImage(characterId.value, sel.id, p.id)
    message.success('已关联到主形象')
    await loadCharacter()
  }

  function onTreeSelectedKeys(keys: Array<string | number>) {
    const k = keys[0]
    selectedImageId.value = k != null ? String(k) : null
  }

  async function handleDrop({
    node,
    dragNode,
    dropPosition
  }: {
    node: TreeOption
    dragNode: TreeOption
    dropPosition: 'before' | 'after' | 'inside'
  }) {
    const dragImage = dragNode.data as CharacterImage | undefined
    const targetImage = node.data as CharacterImage | undefined
    if (!dragImage || !targetImage) return

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

  return {
    // State
    character,
    isLoading,
    selectedImageId,
    selectedImage,
    showAddModal,
    addForm,
    isUploading,
    selectedFile,
    promptDraft,
    generatingByImageId,
    uploadingAvatar,
    batchGeneratingCharacter,
    addByAiLoading,

    // Computed
    projectId,
    characterId,
    projectCharactersInListOrder,
    showCharacterRail,
    treeData,
    characterHasRootBase,
    multipleRootBases,
    selectedImageLoosePrimary,
    selectedImageCanDelete,
    selectedImageParentName,
    selectedImageGenerateDisabled,

    // Exposed for parent usage
    characterStore,
    message,

    // Actions
    openAddModal,
    closeAddModal,
    handleFileChange,
    handleAvatarUpload,
    handleDeleteImage,
    confirmAddImage,
    confirmAddImageByAi,
    savePromptDraft,
    savePromptDraftIfDirty,
    queueSelectedGenerate,
    handleAttachToPrimary,
    onTreeSelectedKeys,
    handleDrop,
    formatImageCostYuan,
    loadCharacter,
    hydrateGeneratingFromQueue
  }
}
