import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useEpisodeStore } from '@/stores/episode'
import { importScript } from '@/api'
import type { ScriptContent } from '@dreamer/shared/types'

export function useProjectScript() {
  const route = useRoute()
  const message = useMessage()
  const episodeStore = useEpisodeStore()

  const projectId = computed(() => route.params.id as string)
  const showCreateModal = ref(false)
  const showExpandModal = ref(false)
  const showImportModal = ref(false)
  const newEpisode = ref({ episodeNum: 1, title: '' })
  const summary = ref('')
  const importContent = ref('')
  const isImporting = ref(false)
  const selectedEpisodeId = ref<string | null>(null)

  // Auto-save state
  const isAutoSaving = ref(false)
  const lastSaved = ref<Date | null>(null)
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  // Watch for script changes and auto-save
  watch(
    () => episodeStore.currentEpisode,
    (episode) => {
      if (!episode) return
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(async () => {
        if (!selectedEpisodeId.value || !episode) return
        isAutoSaving.value = true
        try {
          await episodeStore.updateEpisode(selectedEpisodeId.value, {
            title: episode.title,
            script: episode.script as ScriptContent
          })
          lastSaved.value = new Date()
        } catch (error) {
          console.error('[ProjectScript] Auto-save failed:', error)
        } finally {
          isAutoSaving.value = false
        }
      }, 3000)
    },
    { deep: true, immediate: true }
  )

  onMounted(async () => {
    await episodeStore.fetchEpisodes(projectId.value)
    if (episodeStore.episodes.length > 0) {
      await episodeStore.getEpisode(episodeStore.episodes[0].id)
      selectedEpisodeId.value = episodeStore.episodes[0].id
    }
  })

  async function handleCreateEpisode() {
    const episode = await episodeStore.createEpisode({
      projectId: projectId.value,
      episodeNum: newEpisode.value.episodeNum,
      title: newEpisode.value.title || `第${newEpisode.value.episodeNum}集`
    })
    showCreateModal.value = false
    newEpisode.value = { episodeNum: episodeStore.episodes.length + 1, title: '' }
    selectedEpisodeId.value = episode.id
    await episodeStore.getEpisode(episode.id)
  }

  async function handleSelectEpisode(episodeId: string) {
    selectedEpisodeId.value = episodeId
    await episodeStore.getEpisode(episodeId)
  }

  async function handleExpandScript() {
    if (!selectedEpisodeId.value || !summary.value.trim()) return
    const result = await episodeStore.expandScript(selectedEpisodeId.value, summary.value)
    showExpandModal.value = false
    summary.value = ''
    if (result) {
      await episodeStore.getEpisode(selectedEpisodeId.value)
      message.success('剧本生成成功')
    }
  }

  async function handleSaveScript() {
    if (!selectedEpisodeId.value || !episodeStore.currentEpisode) return
    await episodeStore.updateEpisode(selectedEpisodeId.value, {
      title: episodeStore.currentEpisode.title || undefined,
      script: episodeStore.currentEpisode.script as ScriptContent
    })
    message.success('保存成功')
  }

  async function handleImportScript() {
    if (!importContent.value.trim()) {
      message.warning('请输入或粘贴剧本内容')
      return
    }
    isImporting.value = true
    try {
      const result = await importScript(projectId.value, importContent.value, 'markdown')
      message.success(
        `导入成功！创建了 ${result.episodesCreated} 集，更新了 ${result.episodesUpdated} 集`
      )
      showImportModal.value = false
      importContent.value = ''
      await episodeStore.fetchEpisodes(projectId.value)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      message.error(err.response?.data?.error || '导入失败')
    } finally {
      isImporting.value = false
    }
  }

  function handleFileChange(file: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      importContent.value = (e.target?.result as string) || ''
      message.info(`已读取文件: ${file.name}`)
    }
    reader.onerror = () => {
      message.error('文件读取失败')
    }
    reader.readAsText(file)
  }

  function updateEpisodeTitle(title: string) {
    if (episodeStore.currentEpisode) {
      episodeStore.currentEpisode.title = title
    }
  }

  const script = computed(
    () => episodeStore.currentEpisode?.script as Record<string, unknown> | null
  )
  const hasEpisodes = computed(() => episodeStore.episodes.length > 0)
  const currentEpisodeTitle = computed(() => episodeStore.currentEpisode?.title ?? null)

  return {
    episodeStore,
    projectId,
    showCreateModal,
    showExpandModal,
    showImportModal,
    newEpisode,
    summary,
    importContent,
    isImporting,
    selectedEpisodeId,
    isAutoSaving,
    lastSaved,
    script,
    hasEpisodes,
    currentEpisodeTitle,
    handleCreateEpisode,
    handleSelectEpisode,
    handleExpandScript,
    handleSaveScript,
    handleImportScript,
    handleFileChange,
    updateEpisodeTitle
  }
}
