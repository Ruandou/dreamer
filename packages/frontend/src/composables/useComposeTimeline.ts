import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { useCompositionStore } from '@/stores/composition'
import { useSceneStore } from '@/stores/scene'

export interface TimelineSegment {
  sceneId: string
  takeId: string
  order?: number
  duration: number
  startTime: number
  endTime: number
  videoUrl?: string
  thumbnailUrl?: string
}

export interface AvailableSegment {
  sceneId: string
  takeId: string
  sceneNum: number
  description: string
  videoUrl?: string
  thumbnailUrl?: string
  duration: number
}

export function useComposeTimeline() {
  const message = useMessage()
  const compositionStore = useCompositionStore()
  const sceneStore = useSceneStore()

  const timelineSegments = ref<TimelineSegment[]>([])

  const availableSegments = computed<AvailableSegment[]>(() => {
    const segments: AvailableSegment[] = []
    sceneStore.scenes.forEach((scene) => {
      if (scene.status === 'completed' && scene.takes?.length) {
        const selectedTask = scene.takes.find((t) => t.isSelected && t.videoUrl)
        if (selectedTask) {
          segments.push({
            sceneId: scene.id,
            takeId: selectedTask.id,
            sceneNum: scene.sceneNum,
            description: scene.description,
            videoUrl: selectedTask.videoUrl,
            thumbnailUrl: selectedTask.thumbnailUrl,
            duration: selectedTask.duration || 5
          })
        }
      }
    })
    return segments
  })

  const totalDuration = computed(() =>
    timelineSegments.value.reduce((sum, seg) => sum + (Number(seg.duration) || 5), 0)
  )

  interface CompositionScene {
    sceneId: string
    takeId: string
    order?: number
    take?: { duration?: number }
    videoUrl?: string
    thumbnailUrl?: string
  }

  const handleSelectComposition = async (composition: { id: string }) => {
    await compositionStore.getComposition(composition.id)
    const comp = compositionStore.currentComposition as { scenes?: CompositionScene[] } | undefined
    if (comp?.scenes?.length) {
      timelineSegments.value = comp.scenes.map((row) => ({
        sceneId: row.sceneId,
        takeId: row.takeId,
        order: row.order,
        duration: row.take?.duration || 5,
        videoUrl: row.videoUrl,
        thumbnailUrl: row.thumbnailUrl,
        startTime: 0,
        endTime: 5
      }))
    } else {
      timelineSegments.value = []
    }
  }

  const addToTimeline = (segment: AvailableSegment) => {
    const lastEndTime = timelineSegments.value.reduce((max, seg) => Math.max(max, seg.endTime), 0)
    timelineSegments.value.push({
      sceneId: segment.sceneId,
      takeId: segment.takeId,
      order: timelineSegments.value.length,
      duration: segment.duration || 5,
      startTime: lastEndTime,
      endTime: lastEndTime + (segment.duration || 5),
      videoUrl: segment.videoUrl,
      thumbnailUrl: segment.thumbnailUrl
    })
    message.success('已添加到时间轴')
  }

  const removeFromTimeline = (index: number) => {
    timelineSegments.value.splice(index, 1)
    timelineSegments.value.forEach((seg, i) => {
      seg.order = i
    })
  }

  const moveSegment = (fromIndex: number, toIndex: number) => {
    const [removed] = timelineSegments.value.splice(fromIndex, 1)
    timelineSegments.value.splice(toIndex, 0, removed)
    timelineSegments.value.forEach((seg, i) => {
      seg.order = i
    })
  }

  const handleDragStart = (e: DragEvent, index: number) => {
    ;(e.dataTransfer as DataTransfer).setData('text/plain', index.toString())
  }

  const handleDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt((e.dataTransfer as DataTransfer).getData('text/plain'))
    moveSegment(fromIndex, targetIndex)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const saveTimeline = async () => {
    if (!compositionStore.currentComposition) return
    await compositionStore.updateTimeline(
      compositionStore.currentComposition.id,
      timelineSegments.value.map((seg, i) => ({
        sceneId: seg.sceneId,
        takeId: seg.takeId,
        order: i
      }))
    )
    message.success('时间轴已保存')
  }

  const handleExport = async () => {
    if (!compositionStore.currentComposition) return
    await saveTimeline()
    await compositionStore.triggerExport(compositionStore.currentComposition.id)
    message.info('视频导出中...')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return {
    timelineSegments,
    availableSegments,
    totalDuration,
    handleSelectComposition,
    addToTimeline,
    removeFromTimeline,
    moveSegment,
    handleDragStart,
    handleDrop,
    handleDragOver,
    saveTimeline,
    handleExport,
    formatTime
  }
}
