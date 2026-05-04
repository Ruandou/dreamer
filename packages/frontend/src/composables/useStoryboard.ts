import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import { useSceneStore, type SceneWithTakes } from '@/stores/scene'
import { useEpisodeStore } from '@/stores/episode'
import { useCharacterStore } from '@/stores/character'

export function useStoryboard() {
  const route = useRoute()
  const router = useRouter()
  const message = useMessage()
  const dialog = useDialog()
  const sceneStore = useSceneStore()
  const episodeStore = useEpisodeStore()
  const characterStore = useCharacterStore()

  const projectId = computed(() => route.params.id as string)
  const currentEpisodeId = ref<string | null>(null)

  const showCreateModal = ref(false)
  const showEditorModal = ref(false)
  type SceneEditor = SceneWithTakes & { editPrompt: string }
  const editingScene = ref<SceneEditor | null>(null)
  const newScene = ref({ description: '', prompt: '' })
  const selectedModel = ref<'wan2.6' | 'seedance2.0'>('wan2.6')
  const selectedReferenceImage = ref<string | undefined>()
  const isTrialMode = ref(true)
  const selectedScenes = ref<Set<string>>(new Set())

  // Video preview
  const showVideoPreview = ref(false)
  const previewVideoUrl = ref<string | undefined>()
  const previewThumbnailUrl = ref<string | undefined>()

  // Polling state
  const pollingTasks = ref<Map<string, number>>(new Map())

  const episodeSelectOptions = computed(() =>
    episodeStore.episodes.map((e) => ({
      label: `第 ${e.episodeNum} 集${e.title ? ` · ${e.title}` : ''}`,
      value: e.id
    }))
  )

  async function loadScenesForEpisode(episodeId: string) {
    await sceneStore.fetchEpisodeScenesDetail(episodeId)
  }

  async function onMounted() {
    await episodeStore.fetchEpisodes(projectId.value)
    if (!episodeStore.episodes.length) {
      currentEpisodeId.value = null
      await characterStore.fetchCharacters(projectId.value)
      return
    }
    const fromQuery = route.query.episodeId as string | undefined
    const valid = fromQuery && episodeStore.episodes.some((e) => e.id === fromQuery)
    const id = valid && fromQuery ? fromQuery : episodeStore.episodes[0].id
    currentEpisodeId.value = id
    if (!valid) {
      await router.replace({ query: { ...route.query, episodeId: id } })
    }
    pollingTasks.value.clear()
    await loadScenesForEpisode(id)
    await characterStore.fetchCharacters(projectId.value)
  }

  watch(
    () => route.query.episodeId,
    async (q) => {
      const qid = typeof q === 'string' ? q : undefined
      if (!qid || !episodeStore.episodes.some((e) => e.id === qid)) return
      if (qid === currentEpisodeId.value) return
      currentEpisodeId.value = qid
      pollingTasks.value.clear()
      selectedScenes.value.clear()
      selectedScenes.value = new Set()
      await loadScenesForEpisode(qid)
    }
  )

  function onEpisodeSelect(episodeId: string) {
    router.push({ query: { ...route.query, episodeId } })
  }

  watch(
    () => sceneStore.scenes,
    (scenes) => {
      scenes.forEach((scene) => {
        if (scene.status === 'processing' && !pollingTasks.value.has(scene.id)) {
          startPolling(scene.id)
        }
      })
    },
    { deep: true }
  )

  const startPolling = (sceneId: string) => {
    pollingTasks.value.set(sceneId, 0)
    const poll = async () => {
      if (!pollingTasks.value.has(sceneId)) return

      await sceneStore.getScene(sceneId)
      const scene = sceneStore.currentScene

      if (scene?.status === 'completed' || scene?.status === 'failed') {
        pollingTasks.value.delete(sceneId)
        return
      }

      pollingTasks.value.set(sceneId, (pollingTasks.value.get(sceneId) || 0) + 1)
      setTimeout(poll, 3000)
    }
    setTimeout(poll, 3000)
  }

  async function handleCreateScene() {
    if (!currentEpisodeId.value) return
    await sceneStore.createScene({
      episodeId: currentEpisodeId.value,
      sceneNum: sceneStore.scenes.length + 1,
      description: newScene.value.description,
      prompt: newScene.value.prompt || newScene.value.description
    })
    showCreateModal.value = false
    newScene.value = { description: '', prompt: '' }
    message.success('分镜创建成功')
  }

  function primaryPrompt(scene: SceneWithTakes): string {
    const shots = scene.shots as { description?: string }[] | undefined
    const first = shots?.[0]?.description?.trim()
    if (first) return first
    return scene.description?.trim() || '使用场景描述'
  }

  function handleEditScene(scene: SceneWithTakes) {
    const base = primaryPrompt(scene)
    editingScene.value = {
      ...scene,
      editPrompt: base === '使用场景描述' ? '' : base
    }
    showEditorModal.value = true
  }

  async function handleSaveScene() {
    if (!editingScene.value) return
    await sceneStore.updateScene(editingScene.value.id, {
      description: editingScene.value.description,
      sceneNum: editingScene.value.sceneNum,
      prompt: editingScene.value.editPrompt
    })
    showEditorModal.value = false
    message.success('保存成功')
  }

  async function handleOptimizePrompt() {
    if (!editingScene.value) return
    const optimized = await sceneStore.optimizePrompt(
      editingScene.value.id,
      editingScene.value.editPrompt
    )
    editingScene.value.editPrompt = optimized
    message.success('提示词优化完成')
  }

  async function handleGenerate(sceneId: string) {
    await sceneStore.generateVideo(sceneId, selectedModel.value, {
      referenceImage: selectedReferenceImage.value
    })
    message.info('视频生成任务已提交')
    startPolling(sceneId)
  }

  async function handleBatchGenerate() {
    if (selectedScenes.value.size === 0) return
    await sceneStore.batchGenerate(Array.from(selectedScenes.value), selectedModel.value, {
      referenceImage: selectedReferenceImage.value
    })
    message.info(`已提交 ${selectedScenes.value.size} 个生成任务`)
    Array.from(selectedScenes.value).forEach((id) => startPolling(id))
  }

  async function handleSelectTask(sceneId: string, taskId: string) {
    await sceneStore.selectTask(sceneId, taskId)
    message.success('已选中该版本')
  }

  function handlePreviewVideo(videoUrl: string, thumbnailUrl?: string) {
    previewVideoUrl.value = videoUrl
    previewThumbnailUrl.value = thumbnailUrl
    showVideoPreview.value = true
  }

  function handleDeleteScene(id: string) {
    dialog.warning({
      title: '确认删除',
      content: '确定要删除这个分镜吗？此操作不可撤销。',
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: async () => {
        await sceneStore.deleteScene(id)
        message.success('分镜已删除')
      }
    })
  }

  function toggleSceneSelection(sceneId: string) {
    if (selectedScenes.value.has(sceneId)) {
      selectedScenes.value.delete(sceneId)
    } else {
      selectedScenes.value.add(sceneId)
    }
    selectedScenes.value = new Set(selectedScenes.value)
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      selectedScenes.value = new Set(sceneStore.scenes.map((s) => s.id))
    } else {
      selectedScenes.value.clear()
      selectedScenes.value = new Set(selectedScenes.value)
    }
  }

  function handleBatchAction(key: string) {
    if (key === 'generate') {
      handleBatchGenerate()
    } else if (key === 'delete') {
      handleBatchDelete()
    }
  }

  function handleBatchDelete() {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedScenes.value.size} 个分镜吗？此操作不可撤销。`,
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: async () => {
        for (const sceneId of selectedScenes.value) {
          await sceneStore.deleteScene(sceneId)
        }
        selectedScenes.value.clear()
        selectedScenes.value = new Set(selectedScenes.value)
        message.success('批量删除完成')
      }
    })
  }

  function handleDragStart(e: DragEvent, index: number) {
    ;(e.dataTransfer as DataTransfer).setData('text/plain', index.toString())
  }

  async function handleDrop(e: DragEvent, targetIndex: number) {
    const sourceIndex = parseInt((e.dataTransfer as DataTransfer).getData('text/plain'))
    if (sourceIndex === targetIndex) return

    const scenes = [...sceneStore.scenes]
    const [removed] = scenes.splice(sourceIndex, 1)
    scenes.splice(targetIndex, 0, removed)

    const episodeId = currentEpisodeId.value
    if (episodeId) {
      await sceneStore.reorderScenes(
        episodeId,
        scenes.map((s) => s.id)
      )
      message.success('分镜顺序已更新')
    }
  }

  function goBack() {
    router.push(`/project/${projectId.value}/episodes`)
  }

  return {
    // State
    projectId,
    currentEpisodeId,
    showCreateModal,
    showEditorModal,
    editingScene,
    newScene,
    selectedModel,
    selectedReferenceImage,
    isTrialMode,
    selectedScenes,
    showVideoPreview,
    previewVideoUrl,
    previewThumbnailUrl,
    pollingTasks,
    episodeSelectOptions,

    // Stores
    sceneStore,
    episodeStore,
    characterStore,

    // Computed helpers
    primaryPrompt,

    // Methods
    onMounted,
    onEpisodeSelect,
    loadScenesForEpisode,
    startPolling,
    handleCreateScene,
    handleEditScene,
    handleSaveScene,
    handleOptimizePrompt,
    handleGenerate,
    handleBatchGenerate,
    handleSelectTask,
    handlePreviewVideo,
    handleDeleteScene,
    toggleSceneSelection,
    toggleSelectAll,
    handleBatchAction,
    handleBatchDelete,
    handleDragStart,
    handleDrop,
    goBack
  }
}
