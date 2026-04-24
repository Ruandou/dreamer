import { ref, computed, toValue } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import type { VideoModel } from '@dreamer/shared/types'
import type { MaybeRefOrGetter } from 'vue'

const VIDEO_MODEL_LS = 'dreamer.episodeWorkbench.videoModel'

interface UseEpisodeVideoGenerationOptions {
  canGenerate: MaybeRefOrGetter<boolean>
  storyboardJobRunning: MaybeRefOrGetter<boolean>
  selectedScene: MaybeRefOrGetter<{ id: string; name?: string; status?: string } | null>
  generateVideo: (sceneId: string, model: VideoModel) => Promise<void>
  reload: () => Promise<void>
}

export function useEpisodeVideoGeneration(options: UseEpisodeVideoGenerationOptions) {
  const message = useMessage()
  const dialog = useDialog()
  const composingId = ref(false)

  const videoModel = ref<string>(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(VIDEO_MODEL_LS) || 'seedance2.0-fast'
      : 'seedance2.0-fast'
  )

  const videoModelOptions = [
    { label: 'Seedance 2.0 · Fast', value: 'seedance2.0-fast' },
    { label: 'Seedance 2.0', value: 'seedance2.0' },
    { label: 'Wan 2.6', value: 'wan2.6' }
  ]

  function toApiVideoModel(ui: string): VideoModel {
    if (ui === 'wan2.6') return 'wan2.6'
    return 'seedance2.0'
  }

  const canGenerateSceneVideo = computed(() => {
    if (!toValue(options.canGenerate)) return false
    if (toValue(options.storyboardJobRunning)) return false
    const sc = toValue(options.selectedScene)
    if (sc?.status === 'processing') return false
    return true
  })

  async function generateSceneVideo() {
    const sc = toValue(options.selectedScene)
    if (!sc) {
      message.warning('暂无入库场次，请先在分镜控制台生成分镜或导入剧本')
      return
    }
    if (toValue(options.storyboardJobRunning)) {
      message.warning('分镜剧本任务运行中，请稍候再试')
      return
    }
    if (sc.status === 'processing') {
      message.warning('当前场次视频生成中，请稍候')
      return
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      dialog.warning({
        title: '确认生成视频',
        content: `即将为场次「${sc.name || sc.id}」生成视频，是否继续？`,
        positiveText: '确认生成',
        negativeText: '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false)
      })
    })

    if (!confirmed) return

    try {
      const model = toApiVideoModel(videoModel.value)
      await options.generateVideo(sc.id, model)
      message.success('视频生成任务已提交，成片就绪后预览区将自动更新')
      await options.reload()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      message.error(err?.response?.data?.error || '提交失败')
    }
  }

  function saveVideoModel() {
    localStorage.setItem(VIDEO_MODEL_LS, videoModel.value)
  }

  return {
    videoModel,
    videoModelOptions,
    composingId,
    canGenerateSceneVideo,
    generateSceneVideo,
    saveVideoModel
  }
}
