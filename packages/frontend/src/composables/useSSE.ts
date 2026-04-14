import { ref, onUnmounted } from 'vue'
import { useNotification } from 'naive-ui'
import { emitProjectUpdateForProject, type ProjectSsePayload } from '@/lib/project-sse-bridge'

export interface TaskUpdate {
  taskId: string
  status: 'processing' | 'completed' | 'failed'
  sceneId: string
  videoUrl?: string
  thumbnailUrl?: string
  cost?: number
  error?: string
}

export function useSSE() {
  let eventSource: EventSource | null = null
  const connected = ref(false)

  const connect = () => {
    // Don't connect if already connected
    if (eventSource) return

    const token = localStorage.getItem('token')
    if (!token) return

    // EventSource 无法设置 Authorization；后端 sse 插件从 query.subscribe 解析 JWT（见 packages/backend/src/plugins/sse.ts）
    eventSource = new EventSource(`/api/sse?subscribe=${encodeURIComponent(token)}`)

    eventSource.addEventListener('connected', () => {
      connected.value = true
      console.log('SSE connected')
    })

    eventSource.addEventListener('task-update', (event) => {
      const data: TaskUpdate = JSON.parse(event.data)
      handleTaskUpdate(data)
    })

    eventSource.addEventListener('project-update', (event) => {
      const data = JSON.parse(event.data)
      handleProjectUpdate(data)
    })

    eventSource.onerror = () => {
      connected.value = false
      eventSource?.close()
      eventSource = null
      console.log('SSE disconnected, reconnecting...')
      setTimeout(connect, 5000)
    }
  }

  const handleTaskUpdate = (data: TaskUpdate) => {
    const notification = useNotification()
    switch (data.status) {
      case 'completed':
        notification.success({
          title: '视频生成完成',
          content: `场景任务已完成${data.cost ? `，成本 ¥${data.cost.toFixed(2)}` : ''}`,
          duration: 5000
        })
        break
      case 'failed':
        notification.error({
          title: '视频生成失败',
          content: data.error || '请稍后重试',
          duration: 8000
        })
        break
      case 'processing':
        console.log('Task processing:', data.taskId)
        break
    }
  }

  const handleProjectUpdate = (data: ProjectSsePayload) => {
    if (data?.projectId) {
      emitProjectUpdateForProject(data)
    }
    if (data?.type === 'image-generation') {
      return
    }
    const notification = useNotification()
    notification.info({
      title: '项目更新',
      content: (data as { message?: string }).message || '项目有新更新',
      duration: 3000
    })
  }

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
      connected.value = false
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    connected,
    connect,
    disconnect
  }
}
